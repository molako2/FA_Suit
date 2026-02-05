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
  useClients,
  useCreateClient,
  useUpdateClient,
  generateClientCode,
  type Client,
} from '@/hooks/useClients';
import { Plus, Pencil, Building2, Search, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { exportClientsCSV } from '@/lib/exports';

export default function Clients() {
  const { role } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formBillingEmail, setFormBillingEmail] = useState('');
  const [formVatNumber, setFormVatNumber] = useState('');

  // Supabase hooks
  const { data: clients = [], isLoading } = useClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormName('');
    setFormAddress('');
    setFormBillingEmail('');
    setFormVatNumber('');
    setEditingClient(null);
  };

  const openDialog = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormName(client.name);
      setFormAddress(client.address || '');
      setFormBillingEmail(client.billing_email || '');
      setFormVatNumber(client.vat_number || '');
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Le nom est obligatoire');
      return;
    }

    if (formVatNumber && formVatNumber.length !== 15) {
      toast.error('Le numéro ICE doit contenir exactement 15 chiffres');
      return;
    }

    try {
      if (editingClient) {
        await updateClient.mutateAsync({
          id: editingClient.id,
          name: formName.trim(),
          address: formAddress.trim() || null,
          billing_email: formBillingEmail.trim() || null,
          vat_number: formVatNumber.trim() || null,
        });
        toast.success('Client modifié');
      } else {
        await createClient.mutateAsync({
          code: generateClientCode(clients),
          name: formName.trim(),
          address: formAddress.trim() || null,
          billing_email: formBillingEmail.trim() || null,
          vat_number: formVatNumber.trim() || null,
          active: true,
        });
        toast.success('Client créé');
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
      console.error(error);
    }
  };

  const toggleActive = async (client: Client) => {
    try {
      await updateClient.mutateAsync({
        id: client.id,
        active: !client.active,
      });
      toast.success(client.active ? 'Client désactivé' : 'Client activé');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const canEdit = role === 'owner' || role === 'assistant' || role === 'sysadmin';
  const isSaving = createClient.isPending || updateClient.isPending;

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
          <h1 className="text-3xl font-bold">Clients</h1>
          <p className="text-muted-foreground">Gestion des clients du cabinet</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              exportClientsCSV(clients.map(c => ({
                code: c.code,
                name: c.name,
                address: c.address,
                billingEmail: c.billing_email,
                vatNumber: c.vat_number,
                active: c.active,
              })));
              toast.success('Export CSV téléchargé');
            }}
            disabled={clients.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          {canEdit && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => openDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau client
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingClient ? 'Modifier le client' : 'Nouveau client'}</DialogTitle>
                <DialogDescription>
                  {editingClient
                    ? `Code client: ${editingClient.code}`
                    : 'Un code client unique sera généré automatiquement.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nom *</Label>
                  <Input
                    id="name"
                    placeholder="Nom du client"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="address">Adresse</Label>
                  <Input
                    id="address"
                    placeholder="Adresse complète"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email">Email de facturation</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="facturation@client.fr"
                    value={formBillingEmail}
                    onChange={(e) => setFormBillingEmail(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ice">Numéro ICE</Label>
                  <Input
                    id="ice"
                    placeholder="000000000000000"
                    value={formVatNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 15);
                      setFormVatNumber(value);
                    }}
                    maxLength={15}
                  />
                  {formVatNumber && formVatNumber.length !== 15 && (
                    <p className="text-xs text-destructive">Le numéro ICE doit contenir exactement 15 chiffres</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingClient ? 'Enregistrer' : 'Créer'}
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
          placeholder="Rechercher un client..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Clients Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Email facturation</TableHead>
                <TableHead className="text-center">Statut</TableHead>
                {canEdit && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 6 : 5} className="text-center py-8 text-muted-foreground">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Aucun client trouvé</p>
                    {canEdit && clients.length === 0 && (
                      <Button
                        variant="link"
                        className="mt-2"
                        onClick={() => openDialog()}
                      >
                        Créer votre premier client
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Badge variant="outline">{client.code}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {client.address || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {client.billing_email || '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {client.active ? (
                        <Badge className="bg-success text-success-foreground">Actif</Badge>
                      ) : (
                        <Badge variant="secondary">Inactif</Badge>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDialog(client)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleActive(client)}
                          >
                            {client.active ? 'Désactiver' : 'Activer'}
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
