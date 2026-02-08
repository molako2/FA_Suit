import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EmojiPicker } from '@/components/messages/EmojiPicker';

const MAX_CHARS = 256;

interface InlineReplyFormProps {
  onSend: (content: string) => Promise<void>;
  onCancel: () => void;
  isPending: boolean;
}

export function InlineReplyForm({ onSend, onCancel, isPending }: InlineReplyFormProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSend = async () => {
    if (!content.trim()) return;
    await onSend(content.trim());
    setContent('');
  };

  return (
    <div className="ml-6 mt-2 p-3 rounded-lg border border-dashed border-primary/30 bg-muted/30">
      <div className="flex items-start gap-2">
        <EmojiPicker onEmojiSelect={handleEmojiSelect} />
        <div className="flex-1">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            maxLength={MAX_CHARS}
            placeholder={t('messages.replyPlaceholder')}
            rows={2}
            className="min-h-[60px]"
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {content.length}/{MAX_CHARS}
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button
          size="sm"
          onClick={handleSend}
          disabled={isPending || !content.trim()}
        >
          {t('messages.send')}
        </Button>
      </div>
    </div>
  );
}
