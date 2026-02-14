import { useState, useMemo } from 'react';
import { format, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isToday, isBefore, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAgendaEntries, useCreateAgendaEntry, useUpdateAgendaEntry, useDeleteAgendaEntry, AgendaEntry } from '@/hooks/useAgenda';
import { CalendarDays, Plus, ChevronLeft, ChevronRight, Trash2, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function Agenda() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<AgendaEntry | null>(null);
  const [noteValue, setNoteValue] = useState('');

  const { data: entries = [], isLoading } = useAgendaEntries();
  const createEntry = useCreateAgendaEntry();
  const updateEntry = useUpdateAgendaEntry();
  const deleteEntry = useDeleteAgendaEntry();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { locale: fr, weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { locale: fr, weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const entriesByDate = useMemo(() => {
    const map = new Map<string, AgendaEntry[]>();
    entries.forEach(e => {
      const key = e.entry_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return map;
  }, [entries]);

  const openAdd = (date: Date) => {
    setSelectedDate(date);
    setEditEntry(null);
    setNoteValue('');
    setDialogOpen(true);
  };

  const openEdit = (entry: AgendaEntry) => {
    setSelectedDate(parseISO(entry.entry_date));
    setEditEntry(entry);
    setNoteValue(entry.note);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!noteValue.trim() || !selectedDate) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    try {
      if (editEntry) {
        await updateEntry.mutateAsync({ id: editEntry.id, note: noteValue.trim(), entry_date: dateStr });
        toast.success('Note mise à jour');
      } else {
        await createEntry.mutateAsync({ entry_date: dateStr, note: noteValue.trim() });
        toast.success('Note ajoutée');
      }
      setDialogOpen(false);
    } catch {
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEntry.mutateAsync(id);
      toast.success('Note supprimée');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="w-6 h-6" />
          Agenda
        </h1>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <CardTitle className="text-lg capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: fr })}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {dayNames.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(day => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayEntries = entriesByDate.get(dateKey) || [];
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const isPast = isBefore(day, addDays(new Date(), -1));

              return (
                <div
                  key={dateKey}
                  className={cn(
                    'min-h-[80px] md:min-h-[100px] border rounded-md p-1 text-xs cursor-pointer transition-colors hover:bg-accent/50',
                    !isCurrentMonth && 'opacity-40',
                    isToday(day) && 'ring-2 ring-primary',
                  )}
                  onClick={() => openAdd(day)}
                >
                  <div className={cn('font-medium text-right mb-0.5', isToday(day) && 'text-primary font-bold')}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayEntries.map(entry => (
                      <div
                        key={entry.id}
                        className={cn(
                          'text-[11px] leading-tight px-1 py-0.5 rounded truncate',
                          isPast ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
                        )}
                        onClick={(e) => { e.stopPropagation(); openEdit(entry); }}
                        title={entry.note}
                      >
                        {entry.note}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming entries list */}
      {entries.filter(e => !isBefore(parseISO(e.entry_date), new Date())).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prochaines échéances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {entries
              .filter(e => !isBefore(parseISO(e.entry_date), addDays(new Date(), -1)))
              .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
              .slice(0, 10)
              .map(entry => (
                <div key={entry.id} className="flex items-center justify-between gap-2 p-2 rounded-md border">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium mr-2">
                      {format(parseISO(entry.entry_date), 'dd/MM/yyyy')}
                    </span>
                    <span className="text-sm text-muted-foreground truncate">{entry.note}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(entry)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(entry.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editEntry ? 'Modifier la note' : 'Ajouter une note'} — {selectedDate ? format(selectedDate, 'dd MMMM yyyy', { locale: fr }) : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Note (max 128 caractères)"
              maxLength={128}
              value={noteValue}
              onChange={e => setNoteValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <p className="text-xs text-muted-foreground">{noteValue.length}/128 — Un rappel email sera envoyé 24h avant cette date.</p>
          </div>
          <DialogFooter className="flex gap-2">
            {editEntry && (
              <Button variant="destructive" size="sm" onClick={() => { handleDelete(editEntry.id); setDialogOpen(false); }}>
                <Trash2 className="w-4 h-4 mr-1" /> Supprimer
              </Button>
            )}
            <Button onClick={handleSave} disabled={!noteValue.trim() || createEntry.isPending || updateEntry.isPending}>
              {createEntry.isPending || updateEntry.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editEntry ? 'Mettre à jour' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
