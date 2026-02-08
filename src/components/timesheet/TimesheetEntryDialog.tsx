import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import {
  roundMinutes,
  formatMinutesToHours,
  useCreateTimesheetEntry,
  useUpdateTimesheetEntry,
  type TimesheetEntry,
} from '@/hooks/useTimesheet';
import type { ProfileWithRole } from '@/hooks/useProfiles';
import type { Matter } from '@/hooks/useMatters';
import { toast } from 'sonner';

interface Client {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

interface Assignment {
  id: string;
  user_id: string;
  matter_id: string;
  start_date: string;
  end_date: string | null;
}

interface TimesheetEntryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingEntry: TimesheetEntry | null;
  canManageAll: boolean;
  profiles: ProfileWithRole[];
  allMatters: Matter[];
  clients: Client[];
  assignments: Assignment[];
  currentUserId: string;
}

export function TimesheetEntryDialog({
  isOpen,
  onOpenChange,
  editingEntry,
  canManageAll,
  profiles,
  allMatters,
  clients,
  assignments,
  currentUserId,
}: TimesheetEntryDialogProps) {
  const { t } = useTranslation();

  const createEntry = useCreateTimesheetEntry();
  const updateEntry = useUpdateTimesheetEntry();
  const isSaving = createEntry.isPending || updateEntry.isPending;

  // Form state
  const [formDate, setFormDate] = useState('');
  const [formMatterId, setFormMatterId] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formBillable, setFormBillable] = useState(true);
  const [formUserId, setFormUserId] = useState('');

  // Initialize form when dialog opens
  useEffect(() => {
    if (!isOpen) return;

    if (editingEntry) {
      setFormDate(editingEntry.date);
      setFormMatterId(editingEntry.matter_id);
      setFormDuration(String(editingEntry.minutes_rounded));
      setFormDescription(editingEntry.description);
      setFormBillable(editingEntry.billable);
      setFormUserId(editingEntry.user_id);
      // Pre-select client based on matter
      const matter = allMatters.find((m) => m.id === editingEntry.matter_id);
      setFormClientId(matter?.client_id || '');
    } else {
      setFormDate(new Date().toISOString().split('T')[0]);
      setFormMatterId('');
      setFormClientId('');
      setFormDuration('');
      setFormDescription('');
      setFormBillable(true);
      setFormUserId(currentUserId);
    }
  }, [isOpen, editingEntry, allMatters, currentUserId]);

  // Selected user ID for matter filtering
  const selectedUserId = canManageAll && formUserId ? formUserId : currentUserId;

  // Available matters: admin sees all open matters (optionally by client), regular user sees assigned only
  const availableMatters = useMemo(() => {
    if (canManageAll) {
      return allMatters.filter(
        (m) => m.status === 'open' && (!formClientId || m.client_id === formClientId)
      );
    }
    // Regular user: assigned matters only
    const today = new Date().toISOString().split('T')[0];
    const userAssignments = assignments.filter(
      (a) =>
        a.user_id === selectedUserId &&
        a.start_date <= today &&
        (!a.end_date || a.end_date >= today)
    );
    const assignedMatterIds = new Set(userAssignments.map((a) => a.matter_id));
    return allMatters.filter((m) => assignedMatterIds.has(m.id) && m.status === 'open');
  }, [canManageAll, formClientId, selectedUserId, assignments, allMatters]);

  const activeClients = useMemo(() => clients.filter((c) => c.active), [clients]);

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
    const targetUserId = canManageAll && formUserId ? formUserId : currentUserId;

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
      onOpenChange(false);
    } catch (error) {
      toast.error(t('errors.saveError'));
      console.error(error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingEntry ? t('timesheet.editEntry') : t('timesheet.newEntry')}
          </DialogTitle>
          <DialogDescription>{t('timesheet.roundingNote')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Collaborator selector (admin only) */}
          {canManageAll && (
            <div className="grid gap-2">
              <Label>{t('timesheet.collaborator')}</Label>
              <Select
                value={formUserId}
                onValueChange={(value) => {
                  setFormUserId(value);
                  // Reset matter when user changes (for non-admin, matters are assignment-based)
                  if (!canManageAll) setFormMatterId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('timesheet.selectCollaborator')} />
                </SelectTrigger>
                <SelectContent>
                  {profiles
                    .filter((p) => p.active)
                    .map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name} ({profile.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date */}
          <div className="grid gap-2">
            <Label>{t('common.date')}</Label>
            <Input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
            />
          </div>

          {/* Client selector (admin only) */}
          {canManageAll && (
            <div className="grid gap-2">
              <Label>{t('timesheet.client')}</Label>
              <Select
                value={formClientId}
                onValueChange={(value) => {
                  setFormClientId(value);
                  setFormMatterId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('timesheet.selectClient')} />
                </SelectTrigger>
                <SelectContent>
                  {activeClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.code} - {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Matter selector */}
          <div className="grid gap-2">
            <Label>{t('timesheet.matter')}</Label>
            <Select value={formMatterId} onValueChange={setFormMatterId}>
              <SelectTrigger>
                <SelectValue placeholder={t('timesheet.selectMatter')} />
              </SelectTrigger>
              <SelectContent>
                {availableMatters.length === 0 ? (
                  <SelectItem value="none" disabled>
                    {canManageAll
                      ? t('timesheet.selectClientFirst')
                      : t('timesheet.noAssignedMatters')}
                  </SelectItem>
                ) : (
                  availableMatters.map((matter) => {
                    const client = clients.find((c) => c.id === matter.client_id);
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

          {/* Duration */}
          <div className="grid gap-2">
            <Label>{t('timesheet.durationMinutes')}</Label>
            <div className="flex items-center gap-2">
              <Input
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
            <p className="text-xs text-muted-foreground">{t('timesheet.roundingNote')}</p>
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label>{t('common.description')}</Label>
            <Textarea
              placeholder="Décrivez votre activité..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Billable toggle */}
          <div className="flex items-center justify-between">
            <Label>{t('common.billable')}</Label>
            <Switch checked={formBillable} onCheckedChange={setFormBillable} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {editingEntry ? t('common.save') : t('common.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
