import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Trash2, Reply } from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import type { Message } from '@/hooks/useMessages';

interface MessageItemProps {
  msg: Message;
  userId: string;
  isOwnerOrAdmin: boolean;
  isUnread: boolean;
  isSender: boolean;
  getRecipientName: (msg: Message) => string | null;
  onDelete: (id: string) => void;
  onReply: (msgId: string) => void;
  isReply?: boolean;
}

export function MessageItem({
  msg,
  userId,
  isOwnerOrAdmin,
  isUnread,
  isSender,
  getRecipientName,
  onDelete,
  onReply,
  isReply = false,
}: MessageItemProps) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'fr' ? fr : enUS;

  const canDelete = isSender || isOwnerOrAdmin;

  // Can reply if user is recipient (direct or broadcast) and not the sender
  const canReply =
    !isSender &&
    (msg.recipient_id === userId || msg.recipient_id === null);

  return (
    <div
      className={`p-4 rounded-lg border ${
        isUnread
          ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800'
          : 'bg-card'
      } ${isReply ? 'ml-6 border-l-4 border-l-primary/30' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-medium text-primary">
              {(msg.sender_name || '?')
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{msg.sender_name}</span>
              {msg.recipient_id === null && !isReply && (
                <Badge variant="secondary" className="text-xs">
                  {t('messages.broadcast')}
                </Badge>
              )}
              {isSender && msg.recipient_id && !isReply && (
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
        <div className="flex items-center gap-1 shrink-0">
          {canReply && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-primary"
              onClick={() => onReply(msg.id)}
            >
              <Reply className="w-4 h-4" />
            </Button>
          )}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                >
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
                  <AlertDialogAction onClick={() => onDelete(msg.id)}>
                    {t('common.delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
      <p className="mt-2 text-sm whitespace-pre-wrap break-words">{msg.content}</p>
    </div>
  );
}
