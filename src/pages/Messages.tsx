import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages, useSendMessage, useDeleteMessage, useMarkAsRead } from '@/hooks/useMessages';
import { useProfiles } from '@/hooks/useProfiles';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, MessageSquare } from 'lucide-react';
import { EmojiPicker } from '@/components/messages/EmojiPicker';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

const MAX_CHARS = 256;

export default function Messages() {
  const { t, i18n } = useTranslation();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useMessages(user?.id);
  const { data: profiles = [] } = useProfiles();
  const sendMessage = useSendMessage();
  const deleteMessage = useDeleteMessage();
  const markAsRead = useMarkAsRead();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [recipientId, setRecipientId] = useState<string>('');
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track which broadcasts current user has read
  const [readBroadcastIds, setReadBroadcastIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('message_reads')
      .select('message_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        setReadBroadcastIds(new Set(data?.map(r => r.message_id) || []));
      });
  }, [user?.id, messages]);

  // Mark messages as read on view
  useEffect(() => {
    if (!user?.id || messages.length === 0) return;

    const unreadDirect = messages.filter(
      m => m.recipient_id === user.id && !m.read && m.sender_id !== user.id
    );
    const unreadBroadcasts = messages.filter(
      m => m.recipient_id === null && m.sender_id !== user.id && !readBroadcastIds.has(m.id)
    );

    for (const msg of unreadDirect) {
      markAsRead.mutate({ messageId: msg.id, userId: user.id, isBroadcast: false });
    }
    for (const msg of unreadBroadcasts) {
      markAsRead.mutate({ messageId: msg.id, userId: user.id, isBroadcast: true });
    }
  }, [user?.id, messages, readBroadcastIds]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['messages'] });
        queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const isOwnerOrAdmin = role === 'owner' || role === 'sysadmin';
  const activeProfiles = profiles.filter(p => p.active && p.id !== user?.id);
  const dateLocale = i18n.language === 'fr' ? fr : enUS;

  const isMessageUnread = (msg: typeof messages[0]) => {
    if (!user) return false;
    if (msg.sender_id === user.id) return false;
    if (msg.recipient_id === user.id) return !msg.read;
    if (msg.recipient_id === null) return !readBroadcastIds.has(msg.id);
    return false;
  };

  const canDelete = (msg: typeof messages[0]) => {
    if (!user) return false;
    return msg.sender_id === user.id || isOwnerOrAdmin;
  };

  const handleSend = async () => {
    if (!user?.id) return;
    if (!content.trim()) {
      toast({ title: t('messages.contentRequired'), variant: 'destructive' });
      return;
    }
    if (!recipientId) {
      toast({ title: t('messages.recipientRequired'), variant: 'destructive' });
      return;
    }

    const actualRecipient = recipientId === 'all' ? null : recipientId;

    try {
      await sendMessage.mutateAsync({
        senderId: user.id,
        recipientId: actualRecipient,
        content: content.trim(),
      });
      toast({ title: t('messages.messageSent') });
      setContent('');
      setRecipientId('');
      setDialogOpen(false);
    } catch {
      toast({ title: t('errors.generic'), variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMessage.mutateAsync(id);
      toast({ title: t('messages.messageDeleted') });
    } catch {
      toast({ title: t('errors.deleteError'), variant: 'destructive' });
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      if (content.length + emoji.length <= MAX_CHARS) {
        setContent(prev => prev + emoji);
      }
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.slice(0, start) + emoji + content.slice(end);
    if (newContent.length <= MAX_CHARS) {
      setContent(newContent);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      }, 0);
    }
  };

  const getRecipientName = (msg: typeof messages[0]) => {
    if (msg.recipient_id === null) return null;
    const profile = profiles.find(p => p.id === msg.recipient_id);
    return profile?.name || t('common.unknown');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('messages.title')}</h1>
          <p className="text-muted-foreground">{t('messages.subtitle')}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              {t('messages.newMessage')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('messages.newMessage')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t('messages.recipient')}</Label>
                <Select value={recipientId} onValueChange={setRecipientId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('messages.recipientRequired')} />
                  </SelectTrigger>
                  <SelectContent>
                    {isOwnerOrAdmin && (
                      <SelectItem value="all">{t('messages.everyone')}</SelectItem>
                    )}
                    {activeProfiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('messages.content')}</Label>
                <div className="flex items-start gap-2">
                  <EmojiPicker onEmojiSelect={handleEmojiSelect} />
                  <div className="flex-1">
                    <Textarea
                      ref={textareaRef}
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      maxLength={MAX_CHARS}
                      placeholder={t('messages.maxChars')}
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground mt-1 text-right">
                      {content.length}/{MAX_CHARS}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleSend}
                disabled={sendMessage.isPending || !content.trim() || !recipientId}
              >
                {t('messages.send')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{t('common.loading')}</p>
      ) : messages.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t('messages.noMessages')}</p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-250px)]">
          <div className="space-y-3">
            {messages.map(msg => {
              const unread = isMessageUnread(msg);
              const isSender = msg.sender_id === user?.id;

              return (
                <div
                  key={msg.id}
                  className={`p-4 rounded-lg border ${
                    unread ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800' : 'bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-medium text-primary">
                          {(msg.sender_name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{msg.sender_name}</span>
                          {msg.recipient_id === null && (
                            <Badge variant="secondary" className="text-xs">
                              {t('messages.broadcast')}
                            </Badge>
                          )}
                          {isSender && msg.recipient_id && (
                            <span className="text-xs text-muted-foreground">
                              → {getRecipientName(msg)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(msg.created_at), 'PPp', { locale: dateLocale })}
                        </p>
                      </div>
                    </div>
                    {canDelete(msg) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('messages.confirmDelete')}</AlertDialogTitle>
                            <AlertDialogDescription>{msg.content}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(msg.id)}>
                              {t('common.delete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
