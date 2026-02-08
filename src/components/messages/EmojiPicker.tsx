import { Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useState } from 'react';

const emojiCategories = [
  {
    label: '😊 Smileys',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '😍', '🥰', '😘', '😜', '🤗', '🤔', '😎', '🥳', '😢', '😡', '😱', '🤯', '😴'],
  },
  {
    label: '👍 Gestes',
    emojis: ['👍', '👎', '👋', '🤝', '👏', '🙌', '💪', '🤞', '✌️', '🤙', '👌', '✋'],
  },
  {
    label: '❤️ Symboles',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '⭐', '🔥', '✅', '❌', '⚠️', '💡', '🎉', '🎯', '📌', '📎'],
  },
];

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

export function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="shrink-0">
          <Smile className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        {emojiCategories.map((cat) => (
          <div key={cat.label} className="mb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">{cat.label}</p>
            <div className="flex flex-wrap gap-1">
              {cat.emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-muted text-lg cursor-pointer"
                  onClick={() => {
                    onEmojiSelect(emoji);
                    setOpen(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
