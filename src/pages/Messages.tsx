import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages, useSendMessage, useDeleteMessage, useMarkAsRead } from '@/hooks/useMessages';
import { useProfiles } from '@/hooks/useProfiles';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, MessageSquare } from 'lucide-react';
import { EmojiPicker } from '@/components/messages/EmojiPicker';
import { MessageItem } from '@/components/messages/MessageItem';
import { InlineReplyForm } from '@/components/messages/InlineReplyForm';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import type { Message } from '@/hooks/useMessages';

const MAX_CHARS = 256;

export default function Messages() {
  const { t } = useTranslation();
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

  const [replyingTo, setReplyingTo] = useState<string | null>(null);

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

    // Collect ALL messages (top-level + replies)
    const allMessages = messages.flatMap(m => [m, ...(m.replies || [])]);

    const unreadDirect = allMessages.filter(
      m => m.recipient_id === user.id && !m.read && m.sender_id !== user.id
    );
    const unreadBroadcasts = allMessages.filter(
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

  const isMessageUnread = (msg: Message) => {
    if (!user) return false;
    if (msg.sender_id === user.id) return false;
    if (msg.recipient_id === user.id) return !msg.read;
    if (msg.recipient_id === null) return !readBroadcastIds.has(msg.id);
    return false;
  };

  const getRecipientName = (msg: Message) => {
    if (msg.recipient_id === null) return null;
    const profile = profiles.find(p => p.id === msg.recipient_id);
    return profile?.name || t('common.unknown');
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

  const handleReply = async (parentMsg: Message, replyContent: string) => {
    if (!user?.id) return;
    // Reply goes to the original sender
    const recipientId = parentMsg.sender_id === user.id
      ? parentMsg.recipient_id
      : parentMsg.sender_id;

    // Find the top-level message id (if replying to a reply, use reply_to of parent)
    const topLevelId = parentMsg.reply_to || parentMsg.id;

    try {
      await sendMessage.mutateAsync({
        senderId: user.id,
        recipientId: recipientId,
        content: replyContent,
        replyTo: topLevelId,
      });
      toast({ title: t('messages.replySent') });
      setReplyingTo(null);
    } catch {
      toast({ title: t('errors.generic'), variant: 'destructive' });
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
              const isSender = msg.sender_id === user?.id;

              return (
                <div key={msg.id}>
                  {/* Top-level message */}
                  <MessageItem
                    msg={msg}
                    userId={user?.id || ''}
                    isOwnerOrAdmin={isOwnerOrAdmin}
                    isUnread={isMessageUnread(msg)}
                    isSender={isSender}
                    getRecipientName={getRecipientName}
                    onDelete={handleDelete}
                    onReply={(id) => setReplyingTo(replyingTo === id ? null : id)}
                  />

                  {/* Replies */}
                  {msg.replies && msg.replies.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {msg.replies.map(reply => (
                        <div key={reply.id}>
                          <MessageItem
                            msg={reply}
                            userId={user?.id || ''}
                            isOwnerOrAdmin={isOwnerOrAdmin}
                            isUnread={isMessageUnread(reply)}
                            isSender={reply.sender_id === user?.id}
                            getRecipientName={getRecipientName}
                            onDelete={handleDelete}
                            onReply={(id) => setReplyingTo(replyingTo === id ? null : id)}
                            isReply
                          />
                          {/* Inline reply form on a reply */}
                          {replyingTo === reply.id && (
                            <InlineReplyForm
                              onSend={(content) => handleReply(reply, content)}
                              onCancel={() => setReplyingTo(null)}
                              isPending={sendMessage.isPending}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Inline reply form on top-level message */}
                  {replyingTo === msg.id && (
                    <InlineReplyForm
                      onSend={(content) => handleReply(msg, content)}
                      onCancel={() => setReplyingTo(null)}
                      isPending={sendMessage.isPending}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
