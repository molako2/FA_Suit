import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  useTimesheetEntries,
  useCreateTimesheetEntry,
  useUpdateTimesheetEntry,
  useDeleteTimesheetEntry,
  roundMinutes,
  formatMinutesToHours,
  type TimesheetEntry,
} from '@/hooks/useTimesheet';
import { useMatters } from '@/hooks/useMatters';
import { useClients } from '@/hooks/useClients';
import { useAssignments } from '@/hooks/useAssignments';
import { Plus, Pencil, Trash2, Clock, Lock, Calendar, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Timesheet() {
  const { user } = useAuth();
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [periodTo, setPeriodTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);

  // Form state
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formMatterId, setFormMatterId] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formBillable, setFormBillable] = useState(true);

  // Supabase hooks
  const { data: entries = [], isLoading: entriesLoading } = useTimesheetEntries(
    user?.id,
    periodFrom,
    periodTo
  );
  const { data: allMatters = [], isLoading: mattersLoading } = useMatters();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: assignments = [], isLoading: assignmentsLoading } = useAssignments();
  
  const createEntry = useCreateTimesheetEntry();
  const updateEntry = useUpdateTimesheetEntry();
  const deleteEntry = useDeleteTimesheetEntry();

  // Get user's assigned matters
  const assignedMatters = useMemo(() => {
    if (!user) return [];
    const today = new Date().toISOString().split('T')[0];
    const userAssignments = assignments.filter(a => 
      a.user_id === user.id &&
      a.start_date <= today &&
      (!a.end_date || a.end_date >= today)
    );
    const assignedMatterIds = new Set(userAssignments.map(a => a.matter_id));
    return allMatters.filter(m => assignedMatterIds.has(m.id) && m.status === 'open');
  }, [user, assignments, allMatters]);

  // Calculate totals
  const totals = useMemo(() => {
    const total = entries.reduce((sum, e) => sum + e.minutes_rounded, 0);
    const billable = entries.filter(e => e.billable).reduce((sum, e) => sum + e.minutes_rounded, 0);
    return { total, billable };
  }, [entries]);

  const isLoading = entriesLoading || mattersLoading || clientsLoading || assignmentsLoading;

  if (!user) return null;

  const resetForm = () => {
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormMatterId('');
    setFormDuration('');
    setFormDescription('');
    setFormBillable(true);
    setEditingEntry(null);
  };

  const openDialog = (entry?: TimesheetEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setFormDate(entry.date);
      setFormMatterId(entry.matter_id);
      setFormDuration(String(entry.minutes_rounded));
      setFormDescription(entry.description);
      setFormBillable(entry.billable);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formMatterId || !formDuration || !formDescription) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const durationMinutes = parseInt(formDuration, 10);
    if (isNaN(durationMinutes) || durationMinutes <= 0) {
      toast.error('Durée invalide');
      return;
    }

    const roundedMinutes = roundMinutes(durationMinutes);

    try {
      if (editingEntry) {
        await updateEntry.mutateAsync({
          id: editingEntry.id,
          matter_id: formMatterId,
          date: formDate,
          minutes_rounded: roundedMinutes,
          description: formDescription,
          billable: formBillable,
        });
        toast.success('Entrée modifiée');
      } else {
        await createEntry.mutateAsync({
          user_id: user.id,
          matter_id: formMatterId,
          date: formDate,
          minutes_rounded: roundedMinutes,
          description: formDescription,
          billable: formBillable,
          locked: false,
        });
        toast.success('Entrée créée');
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
      console.error(error);
    }
  };

  const handleDelete = async (entry: TimesheetEntry) => {
    if (entry.locked) {
      toast.error('Cette entrée est verrouillée (facturée)');
      return;
    }
    try {
      await deleteEntry.mutateAsync(entry.id);
      toast.success('Entrée supprimée');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const getMatterLabel = (matterId: string) => {
    const matter = allMatters.find(m => m.id === matterId);
    const client = clients.find(c => c.id === matter?.client_id);
    return matter ? `${matter.code} - ${matter.label} (${client?.name || 'N/A'})` : 'Inconnu';
  };

  const isSaving = createEntry.isPending || updateEntry.isPending;

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
          <h1 className="text-3xl font-bold">Mes temps</h1>
          <p className="text-muted-foreground">Saisie et suivi de vos heures de travail</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle entrée
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingEntry ? 'Modifier l\'entrée' : 'Nouvelle entrée de temps'}</DialogTitle>
              <DialogDescription>
                Saisissez les détails de votre activité. La durée sera arrondie au quart d'heure supérieur.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="matter">Dossier</Label>
                <Select value={formMatterId} onValueChange={setFormMatterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez un dossier" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignedMatters.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Aucun dossier affecté
                      </SelectItem>
                    ) : (
                      assignedMatters.map((matter) => {
                        const client = clients.find(c => c.id === matter.client_id);
                        return (
                          <SelectItem key={matter.id} value={matter.id}>
                            {matter.code} - {matter.label} ({client?.name || 'N/A'})
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="duration">Durée (en minutes)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    step="15"
                    placeholder="ex: 45"
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                  />
                  {formDuration && (
                    <Badge variant="secondary" className="whitespace-nowrap">
                      → {formatMinutesToHours(roundMinutes(parseInt(formDuration) || 0))}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Arrondi automatique au quart d'heure supérieur
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Décrivez votre activité..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="billable">Facturable</Label>
                <Switch
                  id="billable"
                  checked={formBillable}
                  onCheckedChange={setFormBillable}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingEntry ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Period Filter & Summary */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
        <div className="flex items-center gap-2">
          <div className="grid gap-1">
            <Label htmlFor="from" className="text-xs">Du</Label>
            <Input
              id="from"
              type="date"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
              className="w-36"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="to" className="text-xs">Au</Label>
            <Input
              id="to"
              type="date"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
              className="w-36"
            />
          </div>
        </div>
        
        <div className="flex gap-4">
          <Card className="px-4 py-2">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-lg font-semibold">{formatMinutesToHours(totals.total)}</div>
          </Card>
          <Card className="px-4 py-2">
            <div className="text-xs text-muted-foreground">Facturable</div>
            <div className="text-lg font-semibold text-accent">{formatMinutesToHours(totals.billable)}</div>
          </Card>
        </div>
      </div>

      {/* Entries Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Dossier</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Durée</TableHead>
                <TableHead className="text-center">Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Aucune entrée pour cette période</p>
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => openDialog()}
                    >
                      Créer votre première entrée
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {new Date(entry.date).toLocaleDateString('fr-FR')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate">
                        {getMatterLabel(entry.matter_id)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[300px] truncate text-sm">
                        {entry.description}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {formatMinutesToHours(entry.minutes_rounded)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {entry.billable ? (
                          <Badge className="bg-accent text-accent-foreground">Facturable</Badge>
                        ) : (
                          <Badge variant="secondary">Non fact.</Badge>
                        )}
                        {entry.locked && (
                          <Lock className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDialog(entry)}
                          disabled={entry.locked}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(entry)}
                          disabled={entry.locked || deleteEntry.isPending}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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
