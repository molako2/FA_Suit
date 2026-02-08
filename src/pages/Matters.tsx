import { useState, useMemo } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { ColumnHeaderFilter, useColumnFilters, type FilterOption } from '@/components/ColumnHeaderFilter';

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
  const [formBillingType, setFormBillingType] = useState<'time_based' | 'flat_fee'>('time_based');
  const [formFlatFeeCents, setFormFlatFeeCents] = useState('');
  const [formInterventionNature, setFormInterventionNature] = useState('');
  const [formClientSector, setFormClientSector] = useState('');

  // Dropdown options
  const interventionNatureOptions = [
    'Audit contractuel',
    'Autres',
    'CAC',
    'Conseil financier',
    'Conseil fiscal',
    'Externalisation',
    'Expertise Comptable',
    'Formation',
  ];

  const clientSectorOptions = [
    'Agriculture',
    'Agroalimentaire',
    'Autres',
    'Collectivités locales',
    'Etablissement public',
    'Industrie manufacturière',
    'Pêche',
    'Services',
  ];

  // Supabase hooks
  const { data: matters = [], isLoading: mattersLoading } = useMatters();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const createMatter = useCreateMatter();
  const updateMatter = useUpdateMatter();

  const activeClients = clients.filter(c => c.active);

  const { filters, setFilter, passesFilter } = useColumnFilters([
    'client', 'interventionNature', 'clientSector', 'billingType', 'status'
  ] as const);

  const clientFilterOptions: FilterOption[] = useMemo(() => {
    const uniqueClientIds = [...new Set(matters.map((m) => m.client_id))];
    return uniqueClientIds.map((id) => {
      const client = clients.find((c) => c.id === id);
      return { label: client?.name || 'Inconnu', value: id };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [matters, clients]);

  const interventionNatureFilterOptions: FilterOption[] = useMemo(() => {
    const unique = [...new Set(matters.map((m) => m.intervention_nature).filter(Boolean))] as string[];
    return unique.sort().map((v) => ({ label: v, value: v }));
  }, [matters]);

  const clientSectorFilterOptions: FilterOption[] = useMemo(() => {
    const unique = [...new Set(matters.map((m) => m.client_sector).filter(Boolean))] as string[];
    return unique.sort().map((v) => ({ label: v, value: v }));
  }, [matters]);

  const billingTypeFilterOptions: FilterOption[] = [
    { label: 'Temps passé', value: 'time_based' },
    { label: 'Forfait', value: 'flat_fee' },
  ];

  const statusFilterOptions: FilterOption[] = [
    { label: 'Ouvert', value: 'open' },
    { label: 'Clôturé', value: 'closed' },
  ];

  const filteredMatters = useMemo(() => {
    return matters.filter((m) => {
      const matchesSearch =
        m.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClient = passesFilter('client', m.client_id);
      const matchesNature = passesFilter('interventionNature', m.intervention_nature || '');
      const matchesSector = passesFilter('clientSector', m.client_sector || '');
      const matchesBilling = passesFilter('billingType', m.billing_type || 'time_based');
      const matchesStatus = passesFilter('status', m.status);
      return matchesSearch && matchesClient && matchesNature && matchesSector && matchesBilling && matchesStatus;
    });
  }, [matters, searchTerm, filters]);

  const resetForm = () => {
    setFormLabel('');
    setFormClientId('');
    setFormRateCents('');
    setFormVatRate('20');
    setFormBillingType('time_based');
    setFormFlatFeeCents('');
    setFormInterventionNature('');
    setFormClientSector('');
    setEditingMatter(null);
  };

  const openDialog = (matter?: Matter) => {
    if (matter) {
      setEditingMatter(matter);
      setFormLabel(matter.label);
      setFormClientId(matter.client_id);
      setFormRateCents(matter.rate_cents ? String(matter.rate_cents / 100) : '');
      setFormVatRate(String(matter.vat_rate) as '0' | '20');
      setFormBillingType(matter.billing_type || 'time_based');
      setFormFlatFeeCents(matter.flat_fee_cents ? String(matter.flat_fee_cents / 100) : '');
      setFormInterventionNature(matter.intervention_nature || '');
      setFormClientSector(matter.client_sector || '');
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
    if (formBillingType === 'flat_fee' && !formFlatFeeCents) {
      toast.error('Le montant du forfait est obligatoire');
      return;
    }

    const rateCents = formRateCents ? Math.round(parseFloat(formRateCents) * 100) : null;
    const flatFeeCents = formBillingType === 'flat_fee' && formFlatFeeCents 
      ? Math.round(parseFloat(formFlatFeeCents) * 100) 
      : null;

    try {
      if (editingMatter) {
        await updateMatter.mutateAsync({
          id: editingMatter.id,
          label: formLabel.trim(),
          rate_cents: rateCents,
          vat_rate: parseInt(formVatRate),
          billing_type: formBillingType,
          flat_fee_cents: flatFeeCents,
          intervention_nature: formInterventionNature || null,
          client_sector: formClientSector || null,
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
          billing_type: formBillingType,
          flat_fee_cents: flatFeeCents,
          intervention_nature: formInterventionNature || null,
          client_sector: formClientSector || null,
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

                <div className="grid gap-2">
                  <Label htmlFor="interventionNature">Nature de l'intervention</Label>
                  <Select value={formInterventionNature} onValueChange={setFormInterventionNature}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez une nature" />
                    </SelectTrigger>
                    <SelectContent>
                      {interventionNatureOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="clientSector">Secteur d'activité du client</Label>
                  <Select value={formClientSector} onValueChange={setFormClientSector}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez un secteur" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientSectorOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Billing Type */}
                <div className="grid gap-3">
                  <Label>Type de facturation</Label>
                  <RadioGroup
                    value={formBillingType}
                    onValueChange={(v) => setFormBillingType(v as 'time_based' | 'flat_fee')}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="time_based" id="time_based" />
                      <Label htmlFor="time_based" className="font-normal cursor-pointer">
                        Facturation au temps passé
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="flat_fee" id="flat_fee" />
                      <Label htmlFor="flat_fee" className="font-normal cursor-pointer">
                        Facturation au forfait
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Flat fee amount - only shown when flat_fee is selected */}
                {formBillingType === 'flat_fee' && (
                  <div className="grid gap-2">
                    <Label htmlFor="flatFee">Montant du forfait HT (MAD) *</Label>
                    <Input
                      id="flatFee"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ex: 5000.00"
                      value={formFlatFeeCents}
                      onChange={(e) => setFormFlatFeeCents(e.target.value)}
                    />
                  </div>
                )}

                {/* Rate and VAT - only shown for time-based billing */}
                {formBillingType === 'time_based' && (
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
                )}

                {/* VAT for flat fee */}
                {formBillingType === 'flat_fee' && (
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
                )}
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
                <TableHead>
                  <ColumnHeaderFilter
                    title="Client"
                    options={clientFilterOptions}
                    selectedValues={filters.client}
                    onFilterChange={(v) => setFilter('client', v)}
                  />
                </TableHead>
                <TableHead>
                  <ColumnHeaderFilter
                    title="Nature intervention"
                    options={interventionNatureFilterOptions}
                    selectedValues={filters.interventionNature}
                    onFilterChange={(v) => setFilter('interventionNature', v)}
                  />
                </TableHead>
                <TableHead>
                  <ColumnHeaderFilter
                    title="Secteur activité"
                    options={clientSectorFilterOptions}
                    selectedValues={filters.clientSector}
                    onFilterChange={(v) => setFilter('clientSector', v)}
                  />
                </TableHead>
                <TableHead className="text-center">
                  <ColumnHeaderFilter
                    title="Facturation"
                    options={billingTypeFilterOptions}
                    selectedValues={filters.billingType}
                    onFilterChange={(v) => setFilter('billingType', v)}
                    align="center"
                  />
                </TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-center">TVA</TableHead>
                <TableHead className="text-center">
                  <ColumnHeaderFilter
                    title="Statut"
                    options={statusFilterOptions}
                    selectedValues={filters.status}
                    onFilterChange={(v) => setFilter('status', v)}
                    align="center"
                  />
                </TableHead>
                {canEdit && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMatters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 10 : 9} className="text-center py-8 text-muted-foreground">
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
                    <TableCell className="text-muted-foreground">
                      {matter.intervention_nature || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {matter.client_sector || '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={matter.billing_type === 'flat_fee' ? 'default' : 'outline'}>
                        {matter.billing_type === 'flat_fee' ? 'Forfait' : 'Temps passé'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {matter.billing_type === 'flat_fee' 
                        ? (matter.flat_fee_cents ? formatCents(matter.flat_fee_cents) : '—')
                        : (matter.rate_cents ? formatCents(matter.rate_cents) : '—')}
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
