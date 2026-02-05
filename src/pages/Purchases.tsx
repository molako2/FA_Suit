import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePurchases, useCreatePurchase, useUpdatePurchase, useDeletePurchase, PAYMENT_MODES, formatCentsToMAD, type Purchase } from '@/hooks/usePurchases';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function Purchases() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isFr = i18n.language === 'fr';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Form state
  const [formInvoiceNumber, setFormInvoiceNumber] = useState('');
  const [formDesignation, setFormDesignation] = useState('');
  const [formAmountHT, setFormAmountHT] = useState('');
  const [formAmountTVA, setFormAmountTVA] = useState('');
  const [formAmountTTC, setFormAmountTTC] = useState('');
  const [formNumIF, setFormNumIF] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [formICE, setFormICE] = useState('');
  const [formRate, setFormRate] = useState('20');
  const [formProrata, setFormProrata] = useState('100');
  const [formPaymentMode, setFormPaymentMode] = useState('1');
  const [formPaymentDate, setFormPaymentDate] = useState('');
  const [formInvoiceDate, setFormInvoiceDate] = useState('');
  
  const { data: purchases = [], isLoading } = usePurchases();
  const createPurchase = useCreatePurchase();
  const updatePurchase = useUpdatePurchase();
  const deletePurchase = useDeletePurchase();
  
  const filteredPurchases = purchases.filter(p => 
    p.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.supplier.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const resetForm = () => {
    setFormInvoiceNumber('');
    setFormDesignation('');
    setFormAmountHT('');
    setFormAmountTVA('');
    setFormAmountTTC('');
    setFormNumIF('');
    setFormSupplier('');
    setFormICE('');
    setFormRate('20');
    setFormProrata('100');
    setFormPaymentMode('1');
    setFormPaymentDate('');
    setFormInvoiceDate('');
    setEditingPurchase(null);
  };
  
  const openDialog = (purchase?: Purchase) => {
    if (purchase) {
      setEditingPurchase(purchase);
      setFormInvoiceNumber(purchase.invoice_number);
      setFormDesignation(purchase.designation);
      setFormAmountHT((purchase.amount_ht_cents / 100).toString());
      setFormAmountTVA((purchase.amount_tva_cents / 100).toString());
      setFormAmountTTC((purchase.amount_ttc_cents / 100).toString());
      setFormNumIF(purchase.num_if || '');
      setFormSupplier(purchase.supplier);
      setFormICE(purchase.ice || '');
      setFormRate(purchase.rate?.toString() || '');
      setFormProrata(purchase.prorata?.toString() || '');
      setFormPaymentMode(purchase.payment_mode.toString());
      setFormPaymentDate(purchase.payment_date || '');
      setFormInvoiceDate(purchase.invoice_date);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };
  
  const handleSave = async () => {
    if (!formInvoiceNumber.trim() || !formDesignation.trim() || !formSupplier.trim() || !formInvoiceDate) {
      toast.error(isFr ? 'Veuillez remplir les champs obligatoires' : 'Please fill required fields');
      return;
    }
    
    const purchaseData = {
      invoice_number: formInvoiceNumber.trim(),
      designation: formDesignation.trim(),
      amount_ht_cents: Math.round(parseFloat(formAmountHT || '0') * 100),
      amount_tva_cents: Math.round(parseFloat(formAmountTVA || '0') * 100),
      amount_ttc_cents: Math.round(parseFloat(formAmountTTC || '0') * 100),
      num_if: formNumIF.trim() || null,
      supplier: formSupplier.trim(),
      ice: formICE.trim() || null,
      rate: formRate ? parseFloat(formRate) : null,
      prorata: formProrata ? parseFloat(formProrata) : null,
      payment_mode: parseInt(formPaymentMode),
      payment_date: formPaymentDate || null,
      invoice_date: formInvoiceDate,
      created_by: user?.id || null,
    };
    
    try {
      if (editingPurchase) {
        await updatePurchase.mutateAsync({ id: editingPurchase.id, ...purchaseData });
        toast.success(isFr ? 'Achat modifié avec succès' : 'Purchase updated successfully');
      } else {
        await createPurchase.mutateAsync(purchaseData);
        toast.success(isFr ? 'Achat créé avec succès' : 'Purchase created successfully');
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(isFr ? 'Erreur lors de la sauvegarde' : 'Error saving purchase');
    }
  };
  
  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deletePurchase.mutateAsync(deleteConfirmId);
      toast.success(isFr ? 'Achat supprimé' : 'Purchase deleted');
      setDeleteConfirmId(null);
    } catch (error) {
      toast.error(isFr ? 'Erreur lors de la suppression' : 'Error deleting purchase');
    }
  };
  
  const getPaymentModeLabel = (mode: number) => {
    return PAYMENT_MODES.find(m => m.id === mode)?.label || '-';
  };
  
  // Auto-calculate TTC when HT or TVA changes
  const handleAmountHTChange = (value: string) => {
    setFormAmountHT(value);
    const ht = parseFloat(value) || 0;
    const tva = parseFloat(formAmountTVA) || 0;
    setFormAmountTTC((ht + tva).toFixed(2));
  };
  
  const handleAmountTVAChange = (value: string) => {
    setFormAmountTVA(value);
    const ht = parseFloat(formAmountHT) || 0;
    const tva = parseFloat(value) || 0;
    setFormAmountTTC((ht + tva).toFixed(2));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isFr ? 'Achats / Dépenses' : 'Purchases / Expenses'}
          </h1>
          <p className="text-muted-foreground">
            {isFr ? 'Gestion des factures fournisseurs' : 'Supplier invoice management'}
          </p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          {isFr ? 'Nouvel achat' : 'New purchase'}
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{isFr ? 'Liste des achats' : 'Purchase list'}</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={isFr ? 'Rechercher...' : 'Search...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              {isFr ? 'Chargement...' : 'Loading...'}
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {isFr ? 'Aucun achat trouvé' : 'No purchases found'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isFr ? 'N° Facture' : 'Invoice #'}</TableHead>
                    <TableHead>{isFr ? 'Date Facture' : 'Invoice Date'}</TableHead>
                    <TableHead>{isFr ? 'Fournisseur' : 'Supplier'}</TableHead>
                    <TableHead>{isFr ? 'Désignation' : 'Description'}</TableHead>
                    <TableHead className="text-right">{isFr ? 'M HT' : 'Excl. Tax'}</TableHead>
                    <TableHead className="text-right">{isFr ? 'M TVA' : 'VAT'}</TableHead>
                    <TableHead className="text-right">{isFr ? 'M TTC' : 'Incl. Tax'}</TableHead>
                    <TableHead>{isFr ? 'ID Paie' : 'Payment'}</TableHead>
                    <TableHead>{isFr ? 'Date Paiement' : 'Payment Date'}</TableHead>
                    <TableHead className="text-right">{isFr ? 'Actions' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPurchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="font-medium">{purchase.invoice_number}</TableCell>
                      <TableCell>
                        {format(new Date(purchase.invoice_date), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>{purchase.supplier}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{purchase.designation}</TableCell>
                      <TableCell className="text-right">{formatCentsToMAD(purchase.amount_ht_cents)}</TableCell>
                      <TableCell className="text-right">{formatCentsToMAD(purchase.amount_tva_cents)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCentsToMAD(purchase.amount_ttc_cents)}</TableCell>
                      <TableCell>{getPaymentModeLabel(purchase.payment_mode)}</TableCell>
                      <TableCell>
                        {purchase.payment_date 
                          ? format(new Date(purchase.payment_date), 'dd/MM/yyyy', { locale: fr })
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDialog(purchase)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirmId(purchase.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPurchase 
                ? (isFr ? 'Modifier l\'achat' : 'Edit purchase')
                : (isFr ? 'Nouvel achat' : 'New purchase')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">{isFr ? 'N° Facture *' : 'Invoice # *'}</Label>
              <Input
                id="invoiceNumber"
                value={formInvoiceNumber}
                onChange={(e) => setFormInvoiceNumber(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="invoiceDate">{isFr ? 'Date Facture *' : 'Invoice Date *'}</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={formInvoiceDate}
                onChange={(e) => setFormInvoiceDate(e.target.value)}
              />
            </div>
            
            <div className="space-y-2 col-span-2">
              <Label htmlFor="designation">{isFr ? 'Désignation *' : 'Description *'}</Label>
              <Input
                id="designation"
                value={formDesignation}
                onChange={(e) => setFormDesignation(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supplier">{isFr ? 'Fournisseur *' : 'Supplier *'}</Label>
              <Input
                id="supplier"
                value={formSupplier}
                onChange={(e) => setFormSupplier(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="numIF">{isFr ? 'Num IF' : 'Tax ID'}</Label>
              <Input
                id="numIF"
                value={formNumIF}
                onChange={(e) => setFormNumIF(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ice">ICE</Label>
              <Input
                id="ice"
                value={formICE}
                onChange={(e) => setFormICE(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="amountHT">{isFr ? 'Montant HT (MAD)' : 'Amount Excl. Tax (MAD)'}</Label>
              <Input
                id="amountHT"
                type="number"
                step="0.01"
                value={formAmountHT}
                onChange={(e) => handleAmountHTChange(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="amountTVA">{isFr ? 'Montant TVA (MAD)' : 'VAT Amount (MAD)'}</Label>
              <Input
                id="amountTVA"
                type="number"
                step="0.01"
                value={formAmountTVA}
                onChange={(e) => handleAmountTVAChange(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="amountTTC">{isFr ? 'Montant TTC (MAD)' : 'Amount Incl. Tax (MAD)'}</Label>
              <Input
                id="amountTTC"
                type="number"
                step="0.01"
                value={formAmountTTC}
                onChange={(e) => setFormAmountTTC(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="rate">{isFr ? 'Taux' : 'Rate'}</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                value={formRate}
                onChange={(e) => setFormRate(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="prorata">Prorata</Label>
              <Input
                id="prorata"
                type="number"
                step="0.01"
                value={formProrata}
                onChange={(e) => setFormProrata(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="paymentMode">{isFr ? 'Mode de paiement (ID PAIE)' : 'Payment Mode'}</Label>
              <Select value={formPaymentMode} onValueChange={setFormPaymentMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((mode) => (
                    <SelectItem key={mode.id} value={mode.id.toString()}>
                      {mode.id}: {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="paymentDate">{isFr ? 'Date Paiement' : 'Payment Date'}</Label>
              <Input
                id="paymentDate"
                type="date"
                value={formPaymentDate}
                onChange={(e) => setFormPaymentDate(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {isFr ? 'Annuler' : 'Cancel'}
            </Button>
            <Button onClick={handleSave} disabled={createPurchase.isPending || updatePurchase.isPending}>
              {editingPurchase 
                ? (isFr ? 'Modifier' : 'Update')
                : (isFr ? 'Créer' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isFr ? 'Confirmer la suppression' : 'Confirm deletion'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isFr 
                ? 'Êtes-vous sûr de vouloir supprimer cet achat ? Cette action est irréversible.'
                : 'Are you sure you want to delete this purchase? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isFr ? 'Annuler' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {isFr ? 'Supprimer' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
