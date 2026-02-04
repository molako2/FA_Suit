import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getMatters,
  getClients,
  saveMatter,
  generateId,
  generateCode,
  formatCents,
} from '@/lib/storage';
import { Plus, Pencil, FolderOpen, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { Matter } from '@/types';

export default function Matters() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMatter, setEditingMatter] = useState<Matter | null>(null);

  // Form state
  const [formLabel, setFormLabel] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formRateCents, setFormRateCents] = useState('');
  const [formVatRate, setFormVatRate] = useState<'0' | '20'>('20');

  const matters = getMatters();
  const clients = getClients();
  const activeClients = clients.filter(c => c.active);

  const filteredMatters = matters.filter(m =>
    m.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormLabel('');
    setFormClientId('');
    setFormRateCents('');
    setFormVatRate('20');
    setEditingMatter(null);
  };

  const openDialog = (matter?: Matter) => {
    if (matter) {
      setEditingMatter(matter);
      setFormLabel(matter.label);
      setFormClientId(matter.clientId);
      setFormRateCents(matter.rateCents ? String(matter.rateCents / 100) : '');
      setFormVatRate(String(matter.vatRate) as '0' | '20');
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formLabel.trim()) {
      toast.error('Le libellé est obligatoire');
      return;
    }
    if (!editingMatter && !formClientId) {
      toast.error('Veuillez sélectionner un client');
      return;
    }

    const rateCents = formRateCents ? Math.round(parseFloat(formRateCents) * 100) : undefined;

    const matter: Matter = {
      id: editingMatter?.id || generateId(),
      code: editingMatter?.code || generateCode('DOS', matters),
      label: formLabel.trim(),
      clientId: editingMatter?.clientId || formClientId,
      status: editingMatter?.status || 'open',
      rateCents: rateCents || undefined,
      vatRate: parseInt(formVatRate) as 0 | 20,
      createdAt: editingMatter?.createdAt || new Date().toISOString(),
    };

    saveMatter(matter);
    toast.success(editingMatter ? 'Dossier modifié' : 'Dossier créé');
    setIsDialogOpen(false);
    resetForm();
  };

  const toggleStatus = (matter: Matter) => {
    saveMatter({ ...matter, status: matter.status === 'open' ? 'closed' : 'open' });
    toast.success(matter.status === 'open' ? 'Dossier clôturé' : 'Dossier réouvert');
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Inconnu';
  };

  const canEdit = user?.role === 'owner' || user?.role === 'assistant';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dossiers</h1>
          <p className="text-muted-foreground">Gestion des dossiers clients</p>
        </div>

        {canEdit && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Nouveau dossier
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingMatter ? 'Modifier le dossier' : 'Nouveau dossier'}</DialogTitle>
                <DialogDescription>
                  {editingMatter
                    ? `Code: ${editingMatter.code} — Client: ${getClientName(editingMatter.clientId)}`
                    : 'Un code dossier unique sera généré automatiquement.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {!editingMatter && (
                  <div className="grid gap-2">
                    <Label htmlFor="client">Client *</Label>
                    <Select value={formClientId} onValueChange={setFormClientId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un client" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeClients.length === 0 ? (
                          <SelectItem value="none" disabled>
                            Aucun client actif
                          </SelectItem>
                        ) : (
                          activeClients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.code} - {client.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="label">Libellé *</Label>
                  <Input
                    id="label"
                    placeholder="Ex: Contentieux commercial"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="rate">Taux horaire (€)</Label>
                    <Input
                      id="rate"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ex: 180.00"
                      value={formRateCents}
                      onChange={(e) => setFormRateCents(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Laissez vide pour utiliser le taux par défaut
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="vat">TVA</Label>
                    <Select value={formVatRate} onValueChange={(v) => setFormVatRate(v as '0' | '20')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="20">20%</SelectItem>
                        <SelectItem value="0">0% (Exonéré)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleSave}>
                  {editingMatter ? 'Enregistrer' : 'Créer'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un dossier..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Matters Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Taux horaire</TableHead>
                <TableHead className="text-center">TVA</TableHead>
                <TableHead className="text-center">Statut</TableHead>
                {canEdit && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMatters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 7 : 6} className="text-center py-8 text-muted-foreground">
                    <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Aucun dossier trouvé</p>
                    {canEdit && matters.length === 0 && (
                      <Button
                        variant="link"
                        className="mt-2"
                        onClick={() => openDialog()}
                      >
                        Créer votre premier dossier
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredMatters.map((matter) => (
                  <TableRow key={matter.id}>
                    <TableCell>
                      <Badge variant="outline">{matter.code}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{matter.label}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {getClientName(matter.clientId)}
                    </TableCell>
                    <TableCell className="text-right">
                      {matter.rateCents ? formatCents(matter.rateCents) : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{matter.vatRate}%</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {matter.status === 'open' ? (
                        <Badge className="bg-success text-success-foreground">Ouvert</Badge>
                      ) : (
                        <Badge variant="secondary">Clôturé</Badge>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDialog(matter)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleStatus(matter)}
                          >
                            {matter.status === 'open' ? 'Clôturer' : 'Rouvrir'}
                          </Button>
                        </div>
                      </TableCell>
                    )}
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
