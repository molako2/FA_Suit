import { useState } from 'react';
import { Filter } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface FilterOption {
  label: string;
  value: string;
}

interface ColumnHeaderFilterProps {
  title: string;
  options: FilterOption[];
  selectedValues: Set<string>;
  onFilterChange: (values: Set<string>) => void;
  className?: string;
  align?: 'start' | 'center' | 'end';
}

export function ColumnHeaderFilter({
  title,
  options,
  selectedValues,
  onFilterChange,
  className,
  align = 'start',
}: ColumnHeaderFilterProps) {
  const [open, setOpen] = useState(false);
  const isFiltered = selectedValues.size > 0;

  const handleToggle = (value: string) => {
    const newSet = new Set(selectedValues);
    if (newSet.has(value)) {
      newSet.delete(value);
    } else {
      newSet.add(value);
    }
    onFilterChange(newSet);
  };

  const handleClear = () => {
    onFilterChange(new Set());
    setOpen(false);
  };

  const handleSelectAll = () => {
    onFilterChange(new Set(options.map((o) => o.value)));
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <span>{title}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center h-5 w-5 rounded hover:bg-muted/80 transition-colors',
              isFiltered && 'text-primary'
            )}
          >
            <Filter
              className={cn(
                'w-3 h-3',
                isFiltered ? 'fill-primary text-primary' : 'text-muted-foreground'
              )}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" align={align}>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-medium text-muted-foreground">Filtrer par {title.toLowerCase()}</span>
          </div>
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {options.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
              >
                <Checkbox
                  checked={selectedValues.has(option.value)}
                  onCheckedChange={() => handleToggle(option.value)}
                />
                <span className="truncate">{option.label}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-1 mt-2 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-xs h-7"
              onClick={handleSelectAll}
            >
              Tout
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-xs h-7"
              onClick={handleClear}
              disabled={!isFiltered}
            >
              Effacer
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Hook to manage multiple column filters.
 * Returns filter state and a helper to check if a value passes all active filters.
 */
export function useColumnFilters<T extends string>(columns: T[]) {
  const [filters, setFilters] = useState<Record<T, Set<string>>>(
    () => Object.fromEntries(columns.map((col) => [col, new Set<string>()])) as Record<T, Set<string>>
  );

  const setFilter = (column: T, values: Set<string>) => {
    setFilters((prev) => ({ ...prev, [column]: values }));
  };

  const passesFilter = (column: T, value: string): boolean => {
    const activeFilter = filters[column];
    if (!activeFilter || activeFilter.size === 0) return true;
    return activeFilter.has(value);
  };

  const hasActiveFilters = Object.values(filters).some((f) => (f as Set<string>).size > 0);

  const clearAll = () => {
    setFilters(
      Object.fromEntries(columns.map((col) => [col, new Set<string>()])) as Record<T, Set<string>>
    );
  };

  return { filters, setFilter, passesFilter, hasActiveFilters, clearAll };
}
