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
  useMatters,
  useCreateMatter,
  useUpdateMatter,
  generateMatterCode,
  type Matter,
} from '@/hooks/useMatters';
import { useClients } from '@/hooks/useClients';
import { Plus, Pencil, FolderOpen, Search, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { exportMattersCSV } from '@/lib/exports';

// Format cents to MAD
function formatCents(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',') + ' MAD';
}

export default function Matters() {
  const { user, role } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMatter, setEditingMatter] = useState<Matter | null>(null);

  // Form state
  const [formLabel, setFormLabel] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formRateCents, setFormRateCents] = useState('');
  const [formVatRate, setFormVatRate] = useState<'0' | '20'>('20');

  // Supabase hooks
  const { data: matters = [], isLoading: mattersLoading } = useMatters();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const createMatter = useCreateMatter();
  const updateMatter = useUpdateMatter();

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
      setFormClientId(matter.client_id);
      setFormRateCents(matter.rate_cents ? String(matter.rate_cents / 100) : '');
      setFormVatRate(String(matter.vat_rate) as '0' | '20');
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formLabel.trim()) {
      toast.error('Le libellé est obligatoire');
      return;
    }
    if (!editingMatter && !formClientId) {
      toast.error('Veuillez sélectionner un client');
      return;
    }

    const rateCents = formRateCents ? Math.round(parseFloat(formRateCents) * 100) : null;

    try {
      if (editingMatter) {
        await updateMatter.mutateAsync({
          id: editingMatter.id,
          label: formLabel.trim(),
          rate_cents: rateCents,
          vat_rate: parseInt(formVatRate),
        });
        toast.success('Dossier modifié');
      } else {
        const selectedClient = clients.find(c => c.id === formClientId);
        if (!selectedClient) {
          toast.error('Client introuvable');
          return;
        }
        await createMatter.mutateAsync({
          code: generateMatterCode(matters, selectedClient.code),
          label: formLabel.trim(),
          client_id: formClientId,
          status: 'open',
          rate_cents: rateCents,
          vat_rate: parseInt(formVatRate),
        });
        toast.success('Dossier créé');
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
      console.error(error);
    }
  };

  const toggleStatus = async (matter: Matter) => {
    try {
      await updateMatter.mutateAsync({
        id: matter.id,
        status: matter.status === 'open' ? 'closed' : 'open',
      });
      toast.success(matter.status === 'open' ? 'Dossier clôturé' : 'Dossier réouvert');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Inconnu';
  };

  const canEdit = role === 'owner' || role === 'assistant' || role === 'sysadmin';
  const isLoading = mattersLoading || clientsLoading;
  const isSaving = createMatter.isPending || updateMatter.isPending;

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
          <h1 className="text-3xl font-bold">Dossiers</h1>
          <p className="text-muted-foreground">Gestion des dossiers clients</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              exportMattersCSV(
                matters.map(m => ({
                  code: m.code,
                  label: m.label,
                  clientId: m.client_id,
                  status: m.status as 'open' | 'closed',
                  rateCents: m.rate_cents,
                  vatRate: m.vat_rate,
                })),
                clients.map(c => ({
                  id: c.id,
                  code: c.code,
                  name: c.name,
                }))
              );
              toast.success('Export CSV téléchargé');
            }}
            disabled={matters.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
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
                    ? `Code: ${editingMatter.code} — Client: ${getClientName(editingMatter.client_id)}`
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
                    <Label htmlFor="rate">Taux horaire (MAD)</Label>
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
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingMatter ? 'Enregistrer' : 'Créer'}
                </Button>
              </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
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
                      {getClientName(matter.client_id)}
                    </TableCell>
                    <TableCell className="text-right">
                      {matter.rate_cents ? formatCents(matter.rate_cents) : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{matter.vat_rate}%</Badge>
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
