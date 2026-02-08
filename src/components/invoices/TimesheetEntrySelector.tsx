import { useState, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMinutesToHours } from "@/hooks/useTimesheet";
import { formatAmount } from "@/components/ui/currency";
import type { TimesheetEntry } from "@/hooks/useTimesheet";

export interface TimesheetEntryOverride {
  selected: boolean;
  minutesOverride: number | null; // null = use original
  rateOverride: number | null; // null = use default rate (cents)
}

interface Profile {
  id: string;
  name: string;
  rate_cents: number | null;
}

interface TimesheetEntrySelectorProps {
  entries: TimesheetEntry[];
  profiles: Profile[];
  defaultRateCents: number;
  vatRate: number;
  overrides: Record<string, TimesheetEntryOverride>;
  onOverridesChange: (overrides: Record<string, TimesheetEntryOverride>) => void;
  canEditRatesAndMinutes: boolean;
}

export default function TimesheetEntrySelector({
  entries,
  profiles,
  defaultRateCents,
  vatRate,
  overrides,
  onOverridesChange,
  canEditRatesAndMinutes,
}: TimesheetEntrySelectorProps) {
  // Group entries by collaborator
  const groupedEntries = useMemo(() => {
    const groups = new Map<string, { profile: Profile | undefined; entries: TimesheetEntry[] }>();
    
    entries.forEach((entry) => {
      const existing = groups.get(entry.user_id);
      if (existing) {
        existing.entries.push(entry);
      } else {
        const profile = profiles.find((p) => p.id === entry.user_id);
        groups.set(entry.user_id, { profile, entries: [entry] });
      }
    });

    // Sort entries within each group by date
    groups.forEach((group) => {
      group.entries.sort((a, b) => a.date.localeCompare(b.date));
    });

    return groups;
  }, [entries, profiles]);

  const getOverride = (entryId: string): TimesheetEntryOverride => {
    return overrides[entryId] || { selected: true, minutesOverride: null, rateOverride: null };
  };

  const getEffectiveMinutes = (entry: TimesheetEntry): number => {
    const override = getOverride(entry.id);
    return override.minutesOverride !== null ? override.minutesOverride : entry.minutes_rounded;
  };

  const getEffectiveRate = (entry: TimesheetEntry): number => {
    const override = getOverride(entry.id);
    if (override.rateOverride !== null) return override.rateOverride;
    const profile = profiles.find((p) => p.id === entry.user_id);
    return profile?.rate_cents || defaultRateCents;
  };

  const updateOverride = (entryId: string, changes: Partial<TimesheetEntryOverride>) => {
    const current = getOverride(entryId);
    onOverridesChange({
      ...overrides,
      [entryId]: { ...current, ...changes },
    });
  };

  const handleSelectAll = () => {
    const newOverrides = { ...overrides };
    entries.forEach((e) => {
      const current = getOverride(e.id);
      newOverrides[e.id] = { ...current, selected: true };
    });
    onOverridesChange(newOverrides);
  };

  const handleDeselectAll = () => {
    const newOverrides = { ...overrides };
    entries.forEach((e) => {
      const current = getOverride(e.id);
      newOverrides[e.id] = { ...current, selected: false };
    });
    onOverridesChange(newOverrides);
  };

  // Compute totals
  const selectedCount = entries.filter((e) => getOverride(e.id).selected).length;
  const selectedMinutes = entries
    .filter((e) => getOverride(e.id).selected)
    .reduce((sum, e) => sum + getEffectiveMinutes(e), 0);
  const selectedAmountHt = entries
    .filter((e) => getOverride(e.id).selected)
    .reduce((sum, e) => {
      const minutes = getEffectiveMinutes(e);
      const rate = getEffectiveRate(e);
      return sum + Math.round((minutes / 60) * rate);
    }, 0);

  if (entries.length === 0) {
    return (
      <div className="text-center py-4 text-destructive text-sm">
        Aucune entrée facturable non verrouillée pour cette période.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Entrées de temps ({selectedCount}/{entries.length} sélectionnées)
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleSelectAll} className="h-7 text-xs">
            Tout cocher
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleDeselectAll} className="h-7 text-xs">
            Tout décocher
          </Button>
        </div>
      </div>

      <div className="max-h-[400px] overflow-y-auto border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead className="w-24">Date</TableHead>
              <TableHead>Collaborateur</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right w-28">Durée</TableHead>
              <TableHead className="text-right w-32">Taux/h</TableHead>
              <TableHead className="text-right w-28">Montant HT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from(groupedEntries.entries()).map(([userId, group]) => {
              const userEntries = group.entries;
              const profileName = group.profile?.name || "Collaborateur";

              return userEntries.map((entry, idx) => {
                const override = getOverride(entry.id);
                const effectiveMinutes = getEffectiveMinutes(entry);
                const effectiveRate = getEffectiveRate(entry);
                const amountHt = Math.round((effectiveMinutes / 60) * effectiveRate);

                return (
                  <TableRow
                    key={entry.id}
                    className={!override.selected ? "opacity-50" : ""}
                  >
                    <TableCell className="py-1.5">
                      <Checkbox
                        checked={override.selected}
                        onCheckedChange={(checked) => updateOverride(entry.id, { selected: checked === true })}
                      />
                    </TableCell>
                    <TableCell className="py-1.5 text-xs">
                      {new Date(entry.date).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs">
                      {idx === 0 ? (
                        <Badge variant="outline" className="text-xs font-normal">
                          {profileName}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">{profileName}</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs max-w-[200px] truncate" title={entry.description}>
                      {entry.description}
                    </TableCell>
                    <TableCell className="py-1.5 text-right">
                      {canEditRatesAndMinutes && override.selected ? (
                        <Input
                          type="number"
                          step="15"
                          min="0"
                          value={override.minutesOverride !== null ? override.minutesOverride : entry.minutes_rounded}
                          onChange={(e) => {
                            const val = e.target.value;
                            const mins = val ? parseInt(val, 10) : null;
                            updateOverride(entry.id, {
                              minutesOverride: mins !== null && mins !== entry.minutes_rounded ? mins : null,
                            });
                          }}
                          className="w-20 h-7 text-xs text-right ml-auto"
                          title="Minutes"
                        />
                      ) : (
                        <span className="text-xs">{formatMinutesToHours(effectiveMinutes)}</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 text-right">
                      {canEditRatesAndMinutes && override.selected ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={(override.rateOverride !== null ? override.rateOverride : effectiveRate) / 100}
                          onChange={(e) => {
                            const val = e.target.value;
                            const cents = val ? Math.round(parseFloat(val) * 100) : null;
                            const defaultRate = group.profile?.rate_cents || defaultRateCents;
                            updateOverride(entry.id, {
                              rateOverride: cents !== null && cents !== defaultRate ? cents : null,
                            });
                          }}
                          className="w-24 h-7 text-xs text-right ml-auto"
                          title="Taux horaire (MAD)"
                        />
                      ) : (
                        <span className="text-xs">{formatAmount(effectiveRate)} MAD</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 text-right text-xs font-medium">
                      {override.selected ? `${formatAmount(amountHt)} MAD` : "—"}
                    </TableCell>
                  </TableRow>
                );
              });
            })}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      <div className="flex justify-between items-center text-sm pt-1 border-t">
        <span className="text-muted-foreground">
          Total sélectionné : <span className="font-semibold">{formatMinutesToHours(selectedMinutes)}</span>
        </span>
        <span className="font-semibold">
          Montant HT estimé : {formatAmount(selectedAmountHt)} MAD
        </span>
      </div>
    </div>
  );
}
