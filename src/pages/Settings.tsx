import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getCabinetSettings, saveCabinetSettings, formatCents, getAuditLogs, getUsers, addAuditLog, setCurrentUser } from '@/lib/storage';
import { Save, Building2, Shield, FileText, LogOut } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState(getCabinetSettings);
  const [activeTab, setActiveTab] = useState<'cabinet' | 'security'>('cabinet');
  const [logoutAllUserId, setLogoutAllUserId] = useState<string | null>(null);

  const auditLogs = getAuditLogs();
  const users = getUsers();

  if (user?.role !== 'owner') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Accès réservé aux associés.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSave = () => {
    saveCabinetSettings(settings);
    addAuditLog({
      actorUserId: user.id,
      action: 'update_settings',
      entityType: 'cabinet',
      entityId: settings.id,
    });
    toast.success('Paramètres enregistrés');
  };

  const updateField = <K extends keyof typeof settings>(
    field: K,
    value: typeof settings[K]
  ) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoutAll = (userId: string) => {
    // In a real app, this would invalidate all sessions for the user
    // For demo, we just log it and show a message
    addAuditLog({
      actorUserId: user.id,
      action: 'logout_all',
      entityType: 'user',
      entityId: userId,
      metadata: { targetUserId: userId },
    });
    
    const targetUser = users.find(u => u.id === userId);
    toast.success(`Sessions invalidées pour ${targetUser?.name || 'l\'utilisateur'}`);
    
    // If the user logs out themselves, actually log them out
    if (userId === user.id) {
      logout();
    }
    
    setLogoutAllUserId(null);
  };

  const getUserName = (userId: string) => {
    const u = users.find(user => user.id === userId);
    return u?.name || 'Inconnu';
  };

  const formatAuditAction = (action: string) => {
    const labels: Record<string, string> = {
      issue_invoice: 'Émission facture',
      create_credit_note: 'Création avoir',
      override_rate: 'Modification taux',
      logout_all: 'Déconnexion globale',
      update_settings: 'Modification paramètres',
      create_user: 'Création utilisateur',
      update_user: 'Modification utilisateur',
      deactivate_user: 'Désactivation utilisateur',
      create_assignment: 'Création affectation',
      delete_assignment: 'Suppression affectation',
      close_matter: 'Clôture dossier',
    };
    return labels[action] || action;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Paramètres</h1>
          <p className="text-muted-foreground">Configuration du cabinet</p>
        </div>

        {activeTab === 'cabinet' && (
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Enregistrer
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'cabinet' ? 'default' : 'outline'}
          onClick={() => setActiveTab('cabinet')}
        >
          <Building2 className="w-4 h-4 mr-2" />
          Cabinet
        </Button>
        <Button
          variant={activeTab === 'security' ? 'default' : 'outline'}
          onClick={() => setActiveTab('security')}
        >
          <Shield className="w-4 h-4 mr-2" />
          Sécurité
        </Button>
      </div>

      {activeTab === 'cabinet' && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Cabinet Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Informations cabinet
              </CardTitle>
              <CardDescription>
                Ces informations apparaîtront sur vos factures et avoirs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nom du cabinet</Label>
                <Input
                  id="name"
                  value={settings.name}
                  onChange={(e) => updateField('name', e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="address">Adresse</Label>
                <Textarea
                  id="address"
                  value={settings.address || ''}
                  onChange={(e) => updateField('address', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="iban">IBAN</Label>
                <Input
                  id="iban"
                  value={settings.iban || ''}
                  onChange={(e) => updateField('iban', e.target.value)}
                  placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
                />
              </div>
            </CardContent>
          </Card>

          {/* Billing Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Facturation</CardTitle>
              <CardDescription>
                Paramètres par défaut pour la facturation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="rate">Taux horaire par défaut (MAD)</Label>
                <Input
                  id="rate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.rateCabinetCents / 100}
                  onChange={(e) => updateField('rateCabinetCents', Math.round(parseFloat(e.target.value || '0') * 100))}
                />
                <p className="text-xs text-muted-foreground">
                  Ce taux sera utilisé si aucun taux spécifique n'est défini sur le dossier ou le collaborateur.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="vat">TVA par défaut</Label>
                <Select
                  value={String(settings.vatDefault)}
                  onValueChange={(v) => updateField('vatDefault', parseInt(v) as 0 | 20)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20%</SelectItem>
                    <SelectItem value="0">0% (Exonéré)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="mentions">Mentions légales</Label>
                <Textarea
                  id="mentions"
                  value={settings.mentions || ''}
                  onChange={(e) => updateField('mentions', e.target.value)}
                  rows={4}
                  placeholder="Conditions de règlement, mentions légales..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Numbering */}
          <Card>
            <CardHeader>
              <CardTitle>Numérotation</CardTitle>
              <CardDescription>
                Séquences de numérotation pour les factures et avoirs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Année factures</Label>
                  <Input value={settings.invoiceSeqYear} disabled />
                </div>
                <div className="grid gap-2">
                  <Label>Prochain n°</Label>
                  <Input
                    type="number"
                    min="1"
                    value={settings.invoiceSeqNext}
                    onChange={(e) => updateField('invoiceSeqNext', parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Année avoirs</Label>
                  <Input value={settings.creditSeqYear} disabled />
                </div>
                <div className="grid gap-2">
                  <Label>Prochain n°</Label>
                  <Input
                    type="number"
                    min="1"
                    value={settings.creditSeqNext}
                    onChange={(e) => updateField('creditSeqNext', parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Format: YYYY-#### pour factures, AV-YYYY-#### pour avoirs
              </p>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Aperçu</CardTitle>
              <CardDescription>
                Prévisualisation des informations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
                <p className="font-semibold">{settings.name}</p>
                {settings.address && (
                  <p className="text-muted-foreground whitespace-pre-line">{settings.address}</p>
                )}
                {settings.iban && (
                  <p className="text-muted-foreground">IBAN: {settings.iban}</p>
                )}
                <hr className="my-2" />
                <p>Taux horaire: {formatCents(settings.rateCabinetCents)}/h</p>
                <p>TVA par défaut: {settings.vatDefault}%</p>
                <p>Prochaine facture: {settings.invoiceSeqYear}-{String(settings.invoiceSeqNext).padStart(4, '0')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Logout All Sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogOut className="w-5 h-5" />
                Déconnexion globale
              </CardTitle>
              <CardDescription>
                Invalidez toutes les sessions d'un utilisateur. Utile en cas de compromission d'un compte.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {u.role === 'owner' ? 'Associé' : u.role === 'assistant' ? 'Assistant' : 'Collaborateur'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.active ? 'default' : 'secondary'}>
                          {u.active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setLogoutAllUserId(u.id)}
                        >
                          <LogOut className="w-4 h-4 mr-1" />
                          Déconnecter
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Audit Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Journal d'audit
              </CardTitle>
              <CardDescription>
                Historique des actions sensibles effectuées dans l'application.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucune action enregistrée
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entité</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.slice(-50).reverse().map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(log.createdAt).toLocaleString('fr-FR')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {getUserName(log.actorUserId)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {formatAuditAction(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {log.entityType} ({log.entityId.substring(0, 8)}...)
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Logout All Confirmation */}
      <AlertDialog open={!!logoutAllUserId} onOpenChange={() => setLogoutAllUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Déconnecter toutes les sessions ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va invalider toutes les sessions actives de {getUserName(logoutAllUserId || '')}.
              L'utilisateur devra se reconnecter sur tous ses appareils.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => logoutAllUserId && handleLogoutAll(logoutAllUserId)}
            >
              Déconnecter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
