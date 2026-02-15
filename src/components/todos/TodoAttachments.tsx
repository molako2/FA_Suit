import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Paperclip, X, Download, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useTodoAttachments,
  useUploadTodoAttachments,
  useDeleteTodoAttachment,
  downloadTodoAttachment,
  MAX_ATTACHMENT_SIZE,
  type TodoAttachment,
} from '@/hooks/useTodoAttachments';
import { toast } from '@/hooks/use-toast';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

interface TodoAttachmentManagerProps {
  todoId: string;
  userId: string;
  isAdmin: boolean;
}

/** Used inside the create/edit dialog for admins to manage attachments */
export function TodoAttachmentManager({ todoId, userId, isAdmin }: TodoAttachmentManagerProps) {
  const { t } = useTranslation();
  const { data: attachments = [] } = useTodoAttachments(todoId);
  const uploadMut = useUploadTodoAttachments();
  const deleteMut = useDeleteTodoAttachment();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingSize = attachments.reduce((s, a) => s + a.file_size, 0);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newSize = files.reduce((s, f) => s + f.size, 0);
    if (existingSize + newSize > MAX_ATTACHMENT_SIZE) {
      toast({ title: t('todos.fileTooLarge'), variant: 'destructive' });
      return;
    }

    try {
      await uploadMut.mutateAsync({ todoId, files, userId, existingSize });
      toast({ title: t('todos.attachmentUploaded') });
    } catch (err: any) {
      if (err.message === 'SIZE_EXCEEDED') {
        toast({ title: t('todos.fileTooLarge'), variant: 'destructive' });
      } else {
        toast({ title: t('errors.saveError'), variant: 'destructive' });
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (att: TodoAttachment) => {
    try {
      await deleteMut.mutateAsync({ id: att.id, filePath: att.file_path, todoId });
      toast({ title: t('todos.attachmentDeleted') });
    } catch {
      toast({ title: t('errors.deleteError'), variant: 'destructive' });
    }
  };

  const handleDownload = async (att: TodoAttachment) => {
    try {
      await downloadTodoAttachment(att.file_path, att.file_name);
    } catch {
      toast({ title: t('errors.generic'), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-1">
          <Paperclip className="w-4 h-4" />
          {t('todos.attachments')}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatFileSize(existingSize)} / {formatFileSize(MAX_ATTACHMENT_SIZE)}
        </span>
      </div>

      {/* Existing attachments */}
      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-sm"
            >
              <span className="truncate flex-1">{att.file_name}</span>
              <Badge variant="outline" className="text-xs shrink-0">
                {formatFileSize(att.file_size)}
              </Badge>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDownload(att)}>
                  <Download className="w-3.5 h-3.5" />
                </Button>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleDelete(att)}
                    disabled={deleteMut.isPending}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload button (admin only) */}
      {isAdmin && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMut.isPending}
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploadMut.isPending ? t('common.loading') : t('todos.addAttachment')}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">{t('todos.totalSizeLimit')}</p>
        </div>
      )}
    </div>
  );
}

/** Inline attachment list for the collaborator view (download only) */
interface TodoAttachmentListProps {
  todoId: string;
}

export function TodoAttachmentList({ todoId }: TodoAttachmentListProps) {
  const { t } = useTranslation();
  const { data: attachments = [] } = useTodoAttachments(todoId);

  if (!attachments.length) return null;

  const handleDownload = async (att: TodoAttachment) => {
    try {
      await downloadTodoAttachment(att.file_path, att.file_name);
    } catch {
      toast({ title: t('errors.generic'), variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {attachments.map((att) => (
        <Button
          key={att.id}
          variant="outline"
          size="sm"
          className="h-6 text-xs gap-1"
          onClick={() => handleDownload(att)}
        >
          <Download className="w-3 h-3" />
          {att.file_name}
        </Button>
      ))}
    </div>
  );
}
