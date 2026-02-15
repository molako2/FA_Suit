import { CalendarIcon, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format, parse, isValid } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

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
  const locale = isFr ? fr : enUS;

  const hasFilter = dateFrom || dateTo;

  const parseDate = (str: string): Date | undefined => {
    if (!str) return undefined;
    const d = parse(str, 'yyyy-MM-dd', new Date());
    return isValid(d) ? d : undefined;
  };

  const handleSelect = (setter: (v: string) => void) => (date: Date | undefined) => {
    setter(date ? format(date, 'yyyy-MM-dd') : '');
  };

  return (
    <div className="flex items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{isFr ? 'Du' : 'From'}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-9 w-[150px] justify-start text-left font-normal text-sm",
                !dateFrom && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 w-3.5 h-3.5" />
              {dateFrom && parseDate(dateFrom)
                ? format(parseDate(dateFrom)!, 'dd MMM yyyy', { locale })
                : (isFr ? 'Sélectionner' : 'Select')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={parseDate(dateFrom)}
              onSelect={handleSelect(onDateFromChange)}
              initialFocus
              locale={locale}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{isFr ? 'Au' : 'To'}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-9 w-[150px] justify-start text-left font-normal text-sm",
                !dateTo && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 w-3.5 h-3.5" />
              {dateTo && parseDate(dateTo)
                ? format(parseDate(dateTo)!, 'dd MMM yyyy', { locale })
                : (isFr ? 'Sélectionner' : 'Select')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={parseDate(dateTo)}
              onSelect={handleSelect(onDateToChange)}
              initialFocus
              locale={locale}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
      {hasFilter && (
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onClear} title={isFr ? 'Réinitialiser' : 'Clear'}>
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
