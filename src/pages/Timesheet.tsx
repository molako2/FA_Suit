import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useProfiles } from '@/hooks/useProfiles';
import { Plus, Pencil, Trash2, Clock, Lock, Calendar, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Timesheet() {
  const { t } = useTranslation();
  const { user, role } = useAuth();
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
  const [formUserId, setFormUserId] = useState('');

  // Check if user can add for others
  const canAddForOthers = role === 'owner' || role === 'sysadmin';

  // Supabase hooks
  const { data: entries = [], isLoading: entriesLoading } = useTimesheetEntries(
    user?.id,
    periodFrom,
    periodTo
  );
  const { data: allMatters = [], isLoading: mattersLoading } = useMatters();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: assignments = [], isLoading: assignmentsLoading } = useAssignments();
  const { data: profiles = [] } = useProfiles();
  
  const createEntry = useCreateTimesheetEntry();
  const updateEntry = useUpdateTimesheetEntry();
  const deleteEntry = useDeleteTimesheetEntry();

  // Get selected user's assigned matters (or current user if not admin)
  const selectedUserId = canAddForOthers && formUserId ? formUserId : user?.id;
  
  const assignedMatters = useMemo(() => {
    if (!selectedUserId) return [];
    const today = new Date().toISOString().split('T')[0];
    const userAssignments = assignments.filter(a => 
      a.user_id === selectedUserId &&
      a.start_date <= today &&
      (!a.end_date || a.end_date >= today)
    );
    const assignedMatterIds = new Set(userAssignments.map(a => a.matter_id));
    return allMatters.filter(m => assignedMatterIds.has(m.id) && m.status === 'open');
  }, [selectedUserId, assignments, allMatters]);

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
    setFormUserId(user?.id || '');
  };

  const openDialog = (entry?: TimesheetEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setFormDate(entry.date);
      setFormMatterId(entry.matter_id);
      setFormDuration(String(entry.minutes_rounded));
      setFormDescription(entry.description);
      setFormBillable(entry.billable);
      setFormUserId(entry.user_id);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formMatterId || !formDuration || !formDescription) {
      toast.error(t('errors.fillRequired'));
      return;
    }

    const durationMinutes = parseInt(formDuration, 10);
    if (isNaN(durationMinutes) || durationMinutes <= 0) {
      toast.error(t('errors.invalidDuration'));
      return;
    }

    const roundedMinutes = roundMinutes(durationMinutes);

    const targetUserId = canAddForOthers && formUserId ? formUserId : user.id;

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
        toast.success(t('timesheet.entryUpdated'));
      } else {
        await createEntry.mutateAsync({
          user_id: targetUserId,
          matter_id: formMatterId,
          date: formDate,
          minutes_rounded: roundedMinutes,
          description: formDescription,
          billable: formBillable,
          locked: false,
        });
        toast.success(t('timesheet.entryCreated'));
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(t('errors.saveError'));
      console.error(error);
    }
  };

  const handleDelete = async (entry: TimesheetEntry) => {
    if (entry.locked) {
      toast.error(t('timesheet.entryLocked'));
      return;
    }
    try {
      await deleteEntry.mutateAsync(entry.id);
      toast.success(t('timesheet.entryDeleted'));
    } catch (error) {
      toast.error(t('errors.deleteError'));
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
          <h1 className="text-3xl font-bold">{t('timesheet.title')}</h1>
          <p className="text-muted-foreground">{t('timesheet.subtitle')}</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              {t('timesheet.newEntry')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingEntry ? t('timesheet.editEntry') : t('timesheet.newEntry')}</DialogTitle>
              <DialogDescription>
                {t('timesheet.roundingNote')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {canAddForOthers && (
                <div className="grid gap-2">
                  <Label htmlFor="user">{t('timesheet.collaborator')}</Label>
                  <Select value={formUserId} onValueChange={(value) => {
                    setFormUserId(value);
                    setFormMatterId(''); // Reset matter when user changes
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('timesheet.selectCollaborator')} />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.filter(p => p.active).map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name} ({profile.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="date">{t('common.date')}</Label>
                <Input
                  id="date"
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="matter">{t('timesheet.matter')}</Label>
                <Select value={formMatterId} onValueChange={setFormMatterId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('timesheet.selectMatter')} />
                  </SelectTrigger>
                  <SelectContent>
                    {assignedMatters.length === 0 ? (
                      <SelectItem value="none" disabled>
                        {t('timesheet.noAssignedMatters')}
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
                <Label htmlFor="duration">{t('timesheet.durationMinutes')}</Label>
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
                  {t('timesheet.roundingNote')}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">{t('common.description')}</Label>
                <Textarea
                  id="description"
                  placeholder="Décrivez votre activité..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="billable">{t('common.billable')}</Label>
                <Switch
                  id="billable"
                  checked={formBillable}
                  onCheckedChange={setFormBillable}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingEntry ? t('common.save') : t('common.create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Period Filter & Summary */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
        <div className="flex items-center gap-2">
          <div className="grid gap-1">
            <Label htmlFor="from" className="text-xs">{t('common.from')}</Label>
            <Input
              id="from"
              type="date"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
              className="w-36"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="to" className="text-xs">{t('common.to')}</Label>
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
            <div className="text-xs text-muted-foreground">{t('common.total')}</div>
            <div className="text-lg font-semibold">{formatMinutesToHours(totals.total)}</div>
          </Card>
          <Card className="px-4 py-2">
            <div className="text-xs text-muted-foreground">{t('common.billable')}</div>
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
                <TableHead>{t('common.date')}</TableHead>
                <TableHead>{t('timesheet.matter')}</TableHead>
                <TableHead>{t('common.description')}</TableHead>
                <TableHead className="text-center">{t('timesheet.duration')}</TableHead>
                <TableHead className="text-center">{t('common.status')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>{t('timesheet.noEntries')}</p>
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => openDialog()}
                    >
                      {t('timesheet.createFirst')}
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
                          <Badge className="bg-accent text-accent-foreground">{t('common.billable')}</Badge>
                        ) : (
                          <Badge variant="secondary">{t('common.nonBillable')}</Badge>
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
