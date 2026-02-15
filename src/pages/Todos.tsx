import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useProfiles } from '@/hooks/useProfiles';
import { useTodos, useCreateTodo, useUpdateTodo, useDeleteTodo } from '@/hooks/useTodos';
import { format, isPast, parseISO } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { CheckSquare, Plus, Pencil, Trash2, AlertCircle, Download, Unlock, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { exportTodosCSV, type TodoExport } from '@/lib/exports';
import { useTodoAttachmentCounts } from '@/hooks/useTodoAttachments';
import { TodoAttachmentManager, TodoAttachmentList } from '@/components/todos/TodoAttachments';

type TodoStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

const statusColors: Record<TodoStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  done: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  blocked: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export default function Todos() {
  const { t, i18n } = useTranslation();
  const { user, role } = useAuth();
  const isAdmin = role === 'owner' || role === 'sysadmin';
  const dateLocale = i18n.language === 'fr' ? fr : enUS;

  const { data: profiles } = useProfiles();
  const activeProfiles = profiles?.filter(p => p.active) || [];

  const [filterUserId, setFilterUserId] = useState<string>('all');

  // For non-admins, always filter by own user id
  const queryUserId = isAdmin ? (filterUserId === 'all' ? undefined : filterUserId) : user?.id;
  const { data: todos, isLoading } = useTodos(queryUserId);

  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();

  const todoIds = todos?.map(t => t.id) || [];
  const { data: attachmentCounts } = useTodoAttachmentCounts(todoIds);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<{ id: string; title: string; deadline: string; assigned_to: string } | null>(null);
  const [formAssignedTo, setFormAssignedTo] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDeadline, setFormDeadline] = useState<Date | undefined>();

  // Blocked reason dialog
  const [blockedDialogOpen, setBlockedDialogOpen] = useState(false);
  const [blockedTodoId, setBlockedTodoId] = useState<string | null>(null);
  const [blockedReason, setBlockedReason] = useState('');

  const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);

  const openCreateDialog = () => {
    setEditingTodo(null);
    setFormAssignedTo('');
    setFormTitle('');
    setFormDeadline(undefined);
    setDialogOpen(true);
  };

  const openEditDialog = (todo: { id: string; title: string; deadline: string; assigned_to: string }) => {
    setEditingTodo(todo);
    setFormAssignedTo(todo.assigned_to);
    setFormTitle(todo.title);
    setFormDeadline(parseISO(todo.deadline));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formDeadline || !formAssignedTo) {
      toast({ title: t('errors.fillRequired'), variant: 'destructive' });
      return;
    }
    if (formTitle.length > 500) {
      toast({ title: t('errors.maxCharacters', { max: 500 }), variant: 'destructive' });
      return;
    }

    try {
      const deadlineStr = format(formDeadline, 'yyyy-MM-dd');
      if (editingTodo) {
        await updateTodo.mutateAsync({ id: editingTodo.id, title: formTitle, deadline: deadlineStr, assigned_to: formAssignedTo });
        toast({ title: t('todos.taskUpdated') });
        setDialogOpen(false);
      } else {
        const newTodo = await createTodo.mutateAsync({ assigned_to: formAssignedTo, created_by: user!.id, title: formTitle, deadline: deadlineStr });
        toast({ title: t('todos.taskCreated') });
        // Rouvrir en mode édition pour permettre l'ajout de PJ
        setEditingTodo({
          id: newTodo.id,
          title: newTodo.title,
          deadline: newTodo.deadline,
          assigned_to: newTodo.assigned_to,
        });
      }
    } catch {
      toast({ title: t('errors.saveError'), variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTodo.mutateAsync(id);
      toast({ title: t('todos.taskDeleted') });
    } catch {
      toast({ title: t('errors.deleteError'), variant: 'destructive' });
    }
  };

  const handleStatusChange = async (todoId: string, newStatus: TodoStatus) => {
    if (newStatus === 'blocked') {
      setBlockedTodoId(todoId);
      setBlockedReason('');
      setBlockedDialogOpen(true);
      return;
    }
    try {
      await updateTodo.mutateAsync({ id: todoId, status: newStatus, blocked_reason: null });
      toast({ title: t('todos.taskUpdated') });
    } catch {
      toast({ title: t('errors.saveError'), variant: 'destructive' });
    }
  };

  const handleUnblock = async (todoId: string) => {
    try {
      await updateTodo.mutateAsync({ id: todoId, status: 'in_progress', blocked_reason: null });
      toast({ title: t('todos.taskUnblocked') });
    } catch {
      toast({ title: t('errors.saveError'), variant: 'destructive' });
    }
  };

  const handleBlockedSubmit = async () => {
    if (!blockedReason.trim()) {
      toast({ title: t('todos.blockedReasonRequired'), variant: 'destructive' });
      return;
    }
    if (blockedReason.length > 128) {
      toast({ title: t('todos.maxChars'), variant: 'destructive' });
      return;
    }
    try {
      await updateTodo.mutateAsync({ id: blockedTodoId!, status: 'blocked', blocked_reason: blockedReason });
      toast({ title: t('todos.taskUpdated') });
      setBlockedDialogOpen(false);
    } catch {
      toast({ title: t('errors.saveError'), variant: 'destructive' });
    }
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: t('todos.pending'),
      in_progress: t('todos.inProgress'),
      done: t('todos.done'),
      blocked: t('todos.blocked'),
    };
    return map[status] || status;
  };

  const handleExport = () => {
    if (!todos?.length) {
      toast({ title: t('errors.noDataToExport'), variant: 'destructive' });
      return;
    }
    const exportData: TodoExport[] = todos.map(todo => ({
      collaborator: profileMap.get(todo.assigned_to) || t('common.unknown'),
      title: todo.title,
      deadline: format(parseISO(todo.deadline), 'dd/MM/yyyy', { locale: dateLocale }),
      status: todo.status,
      blocked_reason: todo.blocked_reason,
    }));
    exportTodosCSV(exportData);
    toast({ title: t('todos.exportDownloaded') });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CheckSquare className="w-6 h-6" />
            {t('todos.title')}
          </h1>
          <p className="text-muted-foreground">{t('todos.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            {t('todos.export')}
          </Button>
          {isAdmin && (
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              {t('todos.newTask')}
            </Button>
          )}
        </div>
      </div>

      {/* Filter for admins */}
      {isAdmin && (
        <div className="flex items-center gap-2">
          <Label>{t('todos.assignedTo')}</Label>
          <Select value={filterUserId} onValueChange={setFilterUserId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              {activeProfiles.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Todos table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('todos.title')}</CardTitle>
          <CardDescription>{isAdmin ? t('todos.subtitle') : undefined}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">{t('common.loading')}</p>
          ) : !todos?.length ? (
            <p className="text-muted-foreground">{t('todos.noTasks')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && <TableHead>{t('todos.assignedTo')}</TableHead>}
                  <TableHead>{t('todos.task')}</TableHead>
                  <TableHead>{t('todos.deadline')}</TableHead>
                  <TableHead>{t('todos.status')}</TableHead>
                  <TableHead>{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todos.map(todo => {
                  const isOverdue = isPast(parseISO(todo.deadline)) && todo.status !== 'done';
                  return (
                    <TableRow key={todo.id}>
                      {isAdmin && (
                        <TableCell className="font-medium">
                          {profileMap.get(todo.assigned_to) || t('common.unknown')}
                        </TableCell>
                      )}
                      <TableCell className="max-w-xs">
                        <div className="flex items-center gap-1">
                          <span className="break-words">{todo.title}</span>
                          {attachmentCounts?.get(todo.id) && (
                            <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        {!isAdmin && <TodoAttachmentList todoId={todo.id} />}
                      </TableCell>
                      <TableCell>
                        <span className={cn(isOverdue && 'text-destructive font-semibold')}>
                          {format(parseISO(todo.deadline), 'dd/MM/yyyy', { locale: dateLocale })}
                        </span>
                        {isOverdue && (
                          <Badge variant="destructive" className="ml-2 text-xs">
                            {t('todos.overdue')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <Badge className={statusColors[todo.status as TodoStatus]}>
                            {getStatusLabel(todo.status)}
                          </Badge>
                          {todo.status === 'blocked' && todo.blocked_reason && isAdmin && (
                            <p className="mt-1 text-xs italic text-destructive">
                              <AlertCircle className="w-3 h-3 inline mr-1" />
                              {todo.blocked_reason}
                            </p>
                          )}
                          {todo.status === 'blocked' && todo.blocked_reason && !isAdmin && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="ml-1 cursor-help">
                                  <AlertCircle className="w-3.5 h-3.5 inline text-destructive" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <span className="max-w-xs">{todo.blocked_reason}</span>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <div className="flex items-center gap-1">
                            {todo.status === 'blocked' && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => handleUnblock(todo.id)}>
                                    <Unlock className="w-4 h-4 text-green-600" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('todos.unblock')}</TooltipContent>
                              </Tooltip>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(todo)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(todo.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 flex-wrap">
                            {(['done', 'in_progress', 'blocked'] as TodoStatus[]).map(status => (
                              <Button
                                key={status}
                                variant={todo.status === status ? 'default' : 'outline'}
                                size="sm"
                                className="text-xs"
                                onClick={() => handleStatusChange(todo.id, status)}
                              >
                                {getStatusLabel(status)}
                              </Button>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit dialog (admin only) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTodo ? t('todos.editTask') : t('todos.newTask')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('todos.assignedTo')}</Label>
              <Select value={formAssignedTo} onValueChange={setFormAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder={t('todos.selectCollaborator')} />
                </SelectTrigger>
                <SelectContent>
                  {activeProfiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('todos.task')}</Label>
              <Input
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                maxLength={500}
                placeholder={t('todos.task')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('todos.deadline')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !formDeadline && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formDeadline ? format(formDeadline, 'dd/MM/yyyy', { locale: dateLocale }) : t('todos.deadline')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formDeadline}
                    onSelect={setFormDeadline}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            {/* Attachment manager */}
            {editingTodo ? (
              <TodoAttachmentManager todoId={editingTodo.id} userId={user!.id} isAdmin={isAdmin} />
            ) : (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Paperclip className="w-4 h-4" />
                {t('todos.saveToAddAttachments')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={createTodo.isPending || updateTodo.isPending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blocked reason dialog */}
      <Dialog open={blockedDialogOpen} onOpenChange={setBlockedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('todos.blockedReason')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Textarea
              value={blockedReason}
              onChange={e => setBlockedReason(e.target.value)}
              maxLength={128}
              placeholder={t('todos.blockedReason')}
            />
            <p className="text-xs text-muted-foreground">
              {blockedReason.length}/128 — {t('todos.maxChars')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockedDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleBlockedSubmit} disabled={updateTodo.isPending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
