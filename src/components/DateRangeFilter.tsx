import { CalendarIcon, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClear: () => void;
}

export default function DateRangeFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClear,
}: DateRangeFilterProps) {
  const { i18n } = useTranslation();
  const isFr = i18n.language === 'fr';

  const hasFilter = dateFrom || dateTo;

  return (
    <div className="flex items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{isFr ? 'Du' : 'From'}</Label>
        <div className="relative">
          <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="pl-8 h-9 w-[150px] text-sm"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{isFr ? 'Au' : 'To'}</Label>
        <div className="relative">
          <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="pl-8 h-9 w-[150px] text-sm"
          />
        </div>
      </div>
      {hasFilter && (
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onClear} title={isFr ? 'Réinitialiser' : 'Clear'}>
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
