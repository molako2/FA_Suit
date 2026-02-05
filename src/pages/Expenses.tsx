 import { useState, useMemo } from 'react';
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
 import { Plus, Trash2, Loader2, Receipt } from 'lucide-react';
 import { toast } from 'sonner';
 
 export default function Expenses() {
   const { user } = useAuth();
   const [isDialogOpen, setIsDialogOpen] = useState(false);
   
   // Form state
   const [selectedClientId, setSelectedClientId] = useState('');
   const [selectedMatterId, setSelectedMatterId] = useState('');
   const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
   const [nature, setNature] = useState('');
   const [amountTTC, setAmountTTC] = useState('');
   const [billable, setBillable] = useState(true);
 
   // Data hooks
   const { data: expenses = [], isLoading: expensesLoading } = useExpenses(user?.id);
   const { data: clients = [], isLoading: clientsLoading } = useClients();
   const { data: matters = [], isLoading: mattersLoading } = useMatters();
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
 
   const resetForm = () => {
     setSelectedClientId('');
     setSelectedMatterId('');
     setExpenseDate(new Date().toISOString().split('T')[0]);
     setNature('');
     setAmountTTC('');
     setBillable(true);
   };
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     
     if (!user) {
       toast.error('Utilisateur non connecté');
       return;
     }
 
     if (!selectedClientId || !selectedMatterId || !expenseDate || !nature || !amountTTC) {
       toast.error('Veuillez remplir tous les champs obligatoires');
       return;
     }
 
     if (nature.length > 100) {
       toast.error('La nature ne doit pas dépasser 100 caractères');
       return;
     }
 
     const amountCents = Math.round(parseFloat(amountTTC) * 100);
     if (isNaN(amountCents) || amountCents <= 0) {
       toast.error('Montant invalide');
       return;
     }
 
     try {
       await createExpense.mutateAsync({
         user_id: user.id,
         client_id: selectedClientId,
         matter_id: selectedMatterId,
         expense_date: expenseDate,
         nature,
         amount_ttc_cents: amountCents,
         billable,
       });
       toast.success('Frais ajouté avec succès');
       resetForm();
       setIsDialogOpen(false);
     } catch (error: any) {
       toast.error(error.message || 'Erreur lors de l\'ajout du frais');
     }
   };
 
   const handleDelete = async (expenseId: string) => {
     if (!confirm('Êtes-vous sûr de vouloir supprimer ce frais ?')) return;
     
     try {
       await deleteExpense.mutateAsync(expenseId);
       toast.success('Frais supprimé');
     } catch (error: any) {
       toast.error(error.message || 'Erreur lors de la suppression');
     }
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
           <h1 className="text-3xl font-bold">Mes frais</h1>
           <p className="text-muted-foreground">Gérez vos notes de frais</p>
         </div>
         
         <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
           <DialogTrigger asChild>
             <Button>
               <Plus className="w-4 h-4 mr-2" />
               Nouveau frais
             </Button>
           </DialogTrigger>
           <DialogContent className="sm:max-w-[500px]">
             <DialogHeader>
               <DialogTitle>Ajouter un frais</DialogTitle>
               <DialogDescription>
                 Saisissez les informations du frais à ajouter
               </DialogDescription>
             </DialogHeader>
             <form onSubmit={handleSubmit} className="space-y-4">
               {/* Client Code */}
               <div className="grid gap-2">
                 <Label htmlFor="clientCode">Code Client</Label>
                 <Select value={selectedClientId} onValueChange={handleClientChange}>
                   <SelectTrigger>
                     <SelectValue placeholder="Sélectionner un client" />
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
                   <Label>Nom du Client</Label>
                   <Input value={getClientName(selectedClientId)} disabled />
                 </div>
               )}
 
               {/* Matter Code */}
               <div className="grid gap-2">
                 <Label htmlFor="matterCode">Code Dossier</Label>
                 <Select 
                   value={selectedMatterId} 
                   onValueChange={setSelectedMatterId}
                   disabled={!selectedClientId}
                 >
                   <SelectTrigger>
                     <SelectValue placeholder={selectedClientId ? "Sélectionner un dossier" : "Sélectionnez d'abord un client"} />
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
                   <Label>Nom du Dossier</Label>
                   <Input value={getMatterLabel(selectedMatterId)} disabled />
                 </div>
               )}
 
               {/* Expense Date */}
               <div className="grid gap-2">
                 <Label htmlFor="expenseDate">Date de dépense</Label>
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
                 <Label htmlFor="nature">Nature de la dépense</Label>
                 <Input
                   id="nature"
                   value={nature}
                   onChange={(e) => setNature(e.target.value.slice(0, 100))}
                   placeholder="Ex: Déplacement, Repas client..."
                   maxLength={100}
                   required
                 />
                 <p className="text-xs text-muted-foreground">{nature.length}/100 caractères</p>
               </div>
 
               {/* Amount TTC */}
               <div className="grid gap-2">
                 <Label htmlFor="amountTTC">Montant TTC (MAD)</Label>
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
                 <Label htmlFor="billable" className="cursor-pointer">Facturable</Label>
               </div>
 
               <DialogFooter>
                 <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                   Annuler
                 </Button>
                 <Button type="submit" disabled={createExpense.isPending}>
                   {createExpense.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                   Ajouter
                 </Button>
               </DialogFooter>
             </form>
           </DialogContent>
         </Dialog>
       </div>
 
       {/* Expenses Table */}
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Receipt className="w-5 h-5" />
             Liste des frais
           </CardTitle>
           <CardDescription>
             Vos notes de frais enregistrées
           </CardDescription>
         </CardHeader>
         <CardContent>
           <Table>
             <TableHeader>
               <TableRow>
                 <TableHead>Date</TableHead>
                 <TableHead>Client</TableHead>
                 <TableHead>Dossier</TableHead>
                 <TableHead>Nature</TableHead>
                 <TableHead className="text-right">Montant TTC</TableHead>
                 <TableHead className="text-center">Facturable</TableHead>
                 <TableHead></TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {expenses.length === 0 ? (
                 <TableRow>
                   <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                     Aucun frais enregistré
                   </TableCell>
                 </TableRow>
               ) : (
                 expenses.map((expense) => (
                   <TableRow key={expense.id}>
                     <TableCell>{new Date(expense.expense_date).toLocaleDateString('fr-FR')}</TableCell>
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
                     <TableCell>
                       {!expense.locked && (
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