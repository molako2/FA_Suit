import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  useTimesheetEntries,
  useDeleteTimesheetEntry,
  formatMinutesToHours,
  type TimesheetEntry,
} from '@/hooks/useTimesheet';
import { useMatters } from '@/hooks/useMatters';
import { useClients } from '@/hooks/useClients';
import { useAssignments } from '@/hooks/useAssignments';
import { useProfiles } from '@/hooks/useProfiles';
import { TimesheetEntryDialog } from '@/components/timesheet/TimesheetEntryDialog';
import { Plus, Pencil, Trash2, Clock, Lock, Calendar, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function Timesheet() {
  const { t } = useTranslation();
  const { user, role } = useAuth();

  const canManageAll = role === 'owner' || role === 'sysadmin';

  // Filter state
  const [filterUserId, setFilterUserId] = useState<string>('all');
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [periodTo, setPeriodTo] = useState(() => new Date().toISOString().split('T')[0]);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);

  // Determine which userId to pass to the query
  const queryUserId = useMemo(() => {
    if (canManageAll) {
      return filterUserId === 'all' ? undefined : filterUserId;
    }
    return user?.id;
  }, [canManageAll, filterUserId, user?.id]);

  // Data hooks
  const { data: entries = [], isLoading: entriesLoading } = useTimesheetEntries(
    queryUserId,
    periodFrom,
    periodTo
  );
  const { data: allMatters = [], isLoading: mattersLoading } = useMatters();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: assignments = [], isLoading: assignmentsLoading } = useAssignments();
  const { data: profiles = [] } = useProfiles();

  const deleteEntry = useDeleteTimesheetEntry();

  // Calculate totals
  const totals = useMemo(() => {
    const total = entries.reduce((sum, e) => sum + e.minutes_rounded, 0);
    const billable = entries
      .filter((e) => e.billable)
      .reduce((sum, e) => sum + e.minutes_rounded, 0);
    return { total, billable };
  }, [entries]);

  const isLoading = entriesLoading || mattersLoading || clientsLoading || assignmentsLoading;

  if (!user) return null;

  const openDialog = (entry?: TimesheetEntry) => {
    setEditingEntry(entry || null);
    setIsDialogOpen(true);
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
    const matter = allMatters.find((m) => m.id === matterId);
    const client = clients.find((c) => c.id === matter?.client_id);
    return matter ? `${matter.code} - ${matter.label} (${client?.name || 'N/A'})` : 'Inconnu';
  };

  const getCollaboratorName = (userId: string) => {
    const profile = profiles.find((p) => p.id === userId);
    return profile?.name || t('common.unknown');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {canManageAll ? t('timesheet.allTitle') : t('timesheet.title')}
          </h1>
          <p className="text-muted-foreground">{t('timesheet.subtitle')}</p>
        </div>

        <Button onClick={() => openDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          {t('timesheet.newEntry')}
        </Button>
      </div>

      {/* Filters & Summary */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end flex-wrap">
        {canManageAll && (
          <div className="grid gap-1">
            <Label className="text-xs">{t('timesheet.collaborator')}</Label>
            <Select value={filterUserId} onValueChange={setFilterUserId}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {t('timesheet.allCollaborators')}
                  </div>
                </SelectItem>
                {profiles
                  .filter((p) => p.active)
                  .map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="grid gap-1">
            <Label htmlFor="from" className="text-xs">
              {t('common.from')}
            </Label>
            <Input
              id="from"
              type="date"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
              className="w-36"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="to" className="text-xs">
              {t('common.to')}
            </Label>
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
            <div className="text-lg font-semibold text-accent">
              {formatMinutesToHours(totals.billable)}
            </div>
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
                {canManageAll && <TableHead>{t('timesheet.collaborator')}</TableHead>}
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
                  <TableCell
                    colSpan={canManageAll ? 7 : 6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>{t('timesheet.noEntries')}</p>
                    <Button variant="link" className="mt-2" onClick={() => openDialog()}>
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
                    {canManageAll && (
                      <TableCell>
                        <span className="text-sm font-medium">
                          {getCollaboratorName(entry.user_id)}
                        </span>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="max-w-[200px] truncate">
                        {getMatterLabel(entry.matter_id)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[300px] truncate text-sm">{entry.description}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {formatMinutesToHours(entry.minutes_rounded)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {entry.billable ? (
                          <Badge className="bg-accent text-accent-foreground">
                            {t('common.billable')}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{t('common.nonBillable')}</Badge>
                        )}
                        {entry.locked && <Lock className="w-3 h-3 text-muted-foreground" />}
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

      {/* Entry Dialog */}
      <TimesheetEntryDialog
        isOpen={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingEntry(null);
        }}
        editingEntry={editingEntry}
        canManageAll={canManageAll}
        profiles={profiles}
        allMatters={allMatters}
        clients={clients}
        assignments={assignments}
        currentUserId={user.id}
      />
    </div>
  );
}
