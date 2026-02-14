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
import { useCabinetSettings, useUpdateCabinetSettings } from '@/hooks/useCabinetSettings';
import { useProfiles } from '@/hooks/useProfiles';
import { useAuditLogs, useCreateAuditLog } from '@/hooks/useAuditLog';
import { Save, Building2, Shield, FileText, LogOut, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';

// Format cents to MAD
function formatCents(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',') + ' MAD';
}

export default function Settings() {
  const { role, signOut, user } = useAuth();
  const { data: settings, isLoading: settingsLoading } = useCabinetSettings();
  const { data: profiles = [] } = useProfiles();
  const { data: auditLogs = [] } = useAuditLogs(50);
  const updateSettings = useUpdateCabinetSettings();
  const createAuditLog = useCreateAuditLog();
  
  const [activeTab, setActiveTab] = useState<'cabinet' | 'security'>('cabinet');
  const [logoutAllUserId, setLogoutAllUserId] = useState<string | null>(null);
  
  const [localSettings, setLocalSettings] = useState<{
    name: string;
    address: string;
    iban: string;
    mentions: string;
    rate_cabinet_cents: number;
    vat_default: number;
    invoice_seq_next: number;
    credit_seq_next: number;
  } | null>(null);

  // Initialize local settings when data loads
  if (settings && !localSettings) {
    setLocalSettings({
      name: settings.name,
      address: settings.address || '',
      iban: settings.iban || '',
      mentions: settings.mentions || '',
      rate_cabinet_cents: settings.rate_cabinet_cents,
      vat_default: settings.vat_default,
      invoice_seq_next: settings.invoice_seq_next,
      credit_seq_next: settings.credit_seq_next,
    });
  }

  if (role !== 'owner' && role !== 'sysadmin') {
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

  if (settingsLoading || !localSettings) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync(localSettings);
      createAuditLog.mutate({
        action: 'update_settings',
        entity_type: 'cabinet',
        entity_id: 'default',
        details: null,
      });
      toast.success('Paramètres enregistrés');
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const updateField = <K extends keyof typeof localSettings>(
    field: K,
    value: typeof localSettings[K]
  ) => {
    setLocalSettings(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleLogoutAll = async (userId: string) => {
    // Log the action
    createAuditLog.mutate({
      action: 'logout_all',
      entity_type: 'user',
      entity_id: userId,
      details: { targetUserId: userId },
    });
    
    const targetProfile = profiles.find(p => p.id === userId);
    toast.success(`Sessions invalidées pour ${targetProfile?.name || 'l\'utilisateur'}`);
    
    // If the user logs out themselves, actually log them out
    if (userId === user?.id) {
      await signOut();
    }
    
    setLogoutAllUserId(null);
  };

  const getProfileName = (userId: string | null) => {
    if (!userId) return 'Système';
    const profile = profiles.find(p => p.id === userId);
    return profile?.name || 'Inconnu';
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
      delete_matter_document: 'Suppression document',
    };
    return labels[action] || action;
  };

  const roleLabels = {
    owner: 'Associé',
    assistant: 'Assistant',
    collaborator: 'Collaborateur',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Paramètres</h1>
          <p className="text-muted-foreground">Configuration du cabinet</p>
        </div>

        {activeTab === 'cabinet' && (
          <Button onClick={handleSave} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
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
                  value={localSettings.name}
                  onChange={(e) => updateField('name', e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="address">Adresse</Label>
                <Textarea
                  id="address"
                  value={localSettings.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="iban">IBAN</Label>
                <Input
                  id="iban"
                  value={localSettings.iban}
                  onChange={(e) => updateField('iban', e.target.value)}
                  placeholder="MA76 XXXX XXXX XXXX XXXX XXXX XXX"
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
                  value={localSettings.rate_cabinet_cents / 100}
                  onChange={(e) => updateField('rate_cabinet_cents', Math.round(parseFloat(e.target.value || '0') * 100))}
                />
                <p className="text-xs text-muted-foreground">
                  Ce taux sera utilisé si aucun taux spécifique n'est défini sur le dossier ou le collaborateur.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="vat">TVA par défaut</Label>
                <Select
                  value={String(localSettings.vat_default)}
                  onValueChange={(v) => updateField('vat_default', parseInt(v))}
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
                  value={localSettings.mentions}
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
                  <Input value={settings?.invoice_seq_year || new Date().getFullYear()} disabled />
                </div>
                <div className="grid gap-2">
                  <Label>Prochain n°</Label>
                  <Input
                    type="number"
                    min="1"
                    value={localSettings.invoice_seq_next}
                    onChange={(e) => updateField('invoice_seq_next', parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Année avoirs</Label>
                  <Input value={settings?.credit_seq_year || new Date().getFullYear()} disabled />
                </div>
                <div className="grid gap-2">
                  <Label>Prochain n°</Label>
                  <Input
                    type="number"
                    min="1"
                    value={localSettings.credit_seq_next}
                    onChange={(e) => updateField('credit_seq_next', parseInt(e.target.value) || 1)}
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
                <p className="font-semibold">{localSettings.name}</p>
                {localSettings.address && (
                  <p className="text-muted-foreground whitespace-pre-line">{localSettings.address}</p>
                )}
                {localSettings.iban && (
                  <p className="text-muted-foreground">IBAN: {localSettings.iban}</p>
                )}
                <hr className="my-2" />
                <p>Taux horaire: {formatCents(localSettings.rate_cabinet_cents)}/h</p>
                <p>TVA par défaut: {localSettings.vat_default}%</p>
                <p>Prochaine facture: {settings?.invoice_seq_year}-{String(localSettings.invoice_seq_next).padStart(4, '0')}</p>
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
                  {profiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">{profile.name}</TableCell>
                      <TableCell className="text-muted-foreground">{profile.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {profile.role ? roleLabels[profile.role] : 'Non défini'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={profile.active ? 'default' : 'secondary'}>
                          {profile.active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setLogoutAllUserId(profile.id)}
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
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Journal d'audit
                </CardTitle>
                <CardDescription>
                  Historique des actions sensibles effectuées dans l'application.
                </CardDescription>
              </div>
              {auditLogs.length > 0 && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                  const rows = auditLogs.map(log => {
                    const d = log.details as Record<string, unknown> | null;
                    const detailRows = d ? Object.entries(d).map(([k, v]) =>
                      `<tr><td style="padding:4px 12px;color:#64748b;font-size:13px;">${k}</td><td style="padding:4px 12px;font-size:13px;">${String(v ?? '')}</td></tr>`
                    ).join('') : '<tr><td colspan="2" style="padding:4px 12px;color:#94a3b8;font-size:13px;">—</td></tr>';
                    return `<tr>
                      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;white-space:nowrap;">${new Date(log.created_at).toLocaleString('fr-FR')}</td>
                      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;">${getProfileName(log.user_id)}</td>
                      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;"><span style="border:1px solid #cbd5e1;border-radius:4px;padding:2px 8px;font-size:13px;">${formatAuditAction(log.action)}</span></td>
                      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${log.entity_type} ${log.entity_id ? `(${log.entity_id.substring(0, 8)}…)` : ''}</td>
                      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;"><table style="font-size:12px;">${detailRows}</table></td>
                    </tr>`;
                  }).join('');
                  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Journal d'audit – ${new Date().toLocaleDateString('fr-FR')}</title>
                    <style>body{font-family:system-ui,sans-serif;margin:2rem;color:#1e293b}h1{font-size:1.4rem}table{border-collapse:collapse;width:100%}th{text-align:left;padding:10px 12px;background:#f1f5f9;border-bottom:2px solid #cbd5e1;font-size:13px}td{vertical-align:top}</style>
                  </head><body><h1>📋 Journal d'audit détaillé</h1><p style="color:#64748b;margin-bottom:1.5rem">Exporté le ${new Date().toLocaleString('fr-FR')}</p>
                  <table><thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Entité</th><th>Détails</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
                  const blob = new Blob([html], { type: 'text/html' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `journal-audit-${new Date().toISOString().slice(0, 10)}.html`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast.success('Journal d\'audit exporté en HTML');
                }}>
                  <Download className="w-4 h-4" />
                  Télécharger HTML
                </Button>
              )}
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
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(log.created_at).toLocaleString('fr-FR')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {getProfileName(log.user_id)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {formatAuditAction(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {log.entity_type} {log.entity_id ? `(${log.entity_id.substring(0, 8)}...)` : ''}
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
              Cette action va invalider toutes les sessions actives de {getProfileName(logoutAllUserId)}.
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
