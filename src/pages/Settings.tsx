import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getCabinetSettings, saveCabinetSettings, formatCents } from '@/lib/storage';
import { Save, Building2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(getCabinetSettings);

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
    toast.success('Paramètres enregistrés');
  };

  const updateField = <K extends keyof typeof settings>(
    field: K,
    value: typeof settings[K]
  ) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Paramètres</h1>
          <p className="text-muted-foreground">Configuration du cabinet</p>
        </div>

        <Button onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          Enregistrer
        </Button>
      </div>

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
              <Label htmlFor="rate">Taux horaire par défaut (€)</Label>
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
    </div>
  );
}
