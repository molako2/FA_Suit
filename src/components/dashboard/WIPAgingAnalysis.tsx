import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatMinutesToHours } from '@/hooks/useTimesheet';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AgingBuckets {
  under30: number;
  d30to60: number;
  d60to90: number;
  d90to120: number;
  over120: number;
}

interface WIPAgingRow {
  key: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  matterId?: string;
  matterCode?: string;
  matterLabel?: string;
  clientId?: string;
  clientCode?: string;
  clientName?: string;
  billableMinutes: number;
  aging: AgingBuckets;
}

interface Props {
  entries: Array<{
    id: string;
    user_id: string;
    matter_id: string;
    date: string;
    minutes_rounded: number;
    billable: boolean;
    locked: boolean;
  }>;
  profiles: Array<{ id: string; name: string; email: string }>;
  matters: Array<{ id: string; code: string; label: string; client_id: string }>;
  clients: Array<{ id: string; code: string; name: string }>;
  periodFrom: string;
  periodTo: string;
}

const emptyAging = (): AgingBuckets => ({
  under30: 0, d30to60: 0, d60to90: 0, d90to120: 0, over120: 0,
});

const sumAging = (a: AgingBuckets, b: AgingBuckets): AgingBuckets => ({
  under30: a.under30 + b.under30,
  d30to60: a.d30to60 + b.d30to60,
  d60to90: a.d60to90 + b.d60to90,
  d90to120: a.d90to120 + b.d90to120,
  over120: a.over120 + b.over120,
});

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

export function WIPAgingAnalysis({ entries, profiles, matters, clients, periodFrom, periodTo }: Props) {
  const { t } = useTranslation();
  const [groupByCollaborator, setGroupByCollaborator] = useState(true);
  const [groupByMatter, setGroupByMatter] = useState(false);
  const [groupByClient, setGroupByClient] = useState(false);

  const handleToggle = (
    setter: (v: boolean) => void,
    current: boolean,
    others: boolean[],
  ) => {
    // Prevent unchecking the last one
    if (current && others.every(o => !o)) return;
    setter(!current);
  };

  const rows = useMemo<WIPAgingRow[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const grouped = new Map<string, WIPAgingRow>();

    const filtered = entries.filter(e => e.billable && !e.locked);

    filtered.forEach(entry => {
      const entryDate = new Date(entry.date + 'T00:00:00');
      const diffDays = Math.floor((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));

      const matter = matters.find(m => m.id === entry.matter_id);
      const client = matter ? clients.find(c => c.id === matter.client_id) : undefined;
      const profile = profiles.find(p => p.id === entry.user_id);

      const keyParts: string[] = [];
      if (groupByCollaborator) keyParts.push(entry.user_id);
      if (groupByClient) keyParts.push(client?.id || 'unknown');
      if (groupByMatter) keyParts.push(entry.matter_id);
      const key = keyParts.join('|');

      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          userId: groupByCollaborator ? entry.user_id : undefined,
          userName: groupByCollaborator ? (profile?.name || t('common.unknown')) : undefined,
          userEmail: groupByCollaborator ? (profile?.email || '') : undefined,
          matterId: groupByMatter ? entry.matter_id : undefined,
          matterCode: groupByMatter ? (matter?.code || '') : undefined,
          matterLabel: groupByMatter ? (matter?.label || t('common.unknown')) : undefined,
          clientId: groupByClient ? (client?.id || '') : undefined,
          clientCode: groupByClient ? (client?.code || '') : undefined,
          clientName: groupByClient ? (client?.name || t('common.unknown')) : undefined,
          billableMinutes: 0,
          aging: emptyAging(),
        });
      }

      const row = grouped.get(key)!;
      row.billableMinutes += entry.minutes_rounded;

      if (diffDays < 30) row.aging.under30 += entry.minutes_rounded;
      else if (diffDays < 60) row.aging.d30to60 += entry.minutes_rounded;
      else if (diffDays < 90) row.aging.d60to90 += entry.minutes_rounded;
      else if (diffDays < 120) row.aging.d90to120 += entry.minutes_rounded;
      else row.aging.over120 += entry.minutes_rounded;
    });

    return Array.from(grouped.values()).sort((a, b) => b.billableMinutes - a.billableMinutes);
  }, [entries, profiles, matters, clients, groupByCollaborator, groupByMatter, groupByClient, t]);

  const totals = useMemo(() => {
    const totalMinutes = rows.reduce((s, r) => s + r.billableMinutes, 0);
    const totalAging = rows.reduce((s, r) => sumAging(s, r.aging), emptyAging());
    return { totalMinutes, totalAging };
  }, [rows]);

  const handleExport = () => {
    if (rows.length === 0) {
      toast.error(t('dashboard.noDataToExport'));
      return;
    }

    const headers: string[] = [];
    if (groupByCollaborator) {
      headers.push(t('dashboard.collaborator'), t('common.email'));
    }
    if (groupByClient) {
      headers.push(t('dashboard.code') + ' ' + t('dashboard.client'), t('dashboard.client'));
    }
    if (groupByMatter) {
      headers.push(t('dashboard.code'), t('dashboard.matter'));
    }
    headers.push(
      t('dashboard.minutes'), t('dashboard.hours'),
      t('dashboard.under30Days'), t('dashboard.d30to60Days'),
      t('dashboard.d60to90Days'), t('dashboard.d90to120Days'),
      t('dashboard.over120Days'),
    );

    const csvRows = rows.map(row => {
      const cols: string[] = [];
      if (groupByCollaborator) {
        cols.push(`"${row.userName || ''}"`, `"${row.userEmail || ''}"`);
      }
      if (groupByClient) {
        cols.push(`"${row.clientCode || ''}"`, `"${row.clientName || ''}"`);
      }
      if (groupByMatter) {
        cols.push(`"${row.matterCode || ''}"`, `"${row.matterLabel || ''}"`);
      }
      cols.push(
        String(row.billableMinutes),
        (row.billableMinutes / 60).toFixed(2),
        (row.aging.under30 / 60).toFixed(2),
        (row.aging.d30to60 / 60).toFixed(2),
        (row.aging.d60to90 / 60).toFixed(2),
        (row.aging.d90to120 / 60).toFixed(2),
        (row.aging.over120 / 60).toFixed(2),
      );
      return cols.join(',');
    });

    downloadCSV(headers.join(',') + '\n' + csvRows.join('\n'), `wip_aging_${periodFrom}_${periodTo}.csv`);
    toast.success(t('dashboard.exportDownloaded'));
  };

  const fmtAging = (minutes: number) => (minutes === 0 ? '—' : formatMinutesToHours(minutes));

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>{t('dashboard.wipAging')}</CardTitle>
          <CardDescription>{t('dashboard.wipAgingDescription')}</CardDescription>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">{t('dashboard.groupBy')} :</span>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <Checkbox
              checked={groupByCollaborator}
              onCheckedChange={() => handleToggle(setGroupByCollaborator, groupByCollaborator, [groupByMatter, groupByClient])}
            />
            {t('dashboard.collaborator')}
          </label>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <Checkbox
              checked={groupByClient}
              onCheckedChange={() => handleToggle(setGroupByClient, groupByClient, [groupByCollaborator, groupByMatter])}
            />
            {t('dashboard.client')}
          </label>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <Checkbox
              checked={groupByMatter}
              onCheckedChange={() => handleToggle(setGroupByMatter, groupByMatter, [groupByCollaborator, groupByClient])}
            />
            {t('dashboard.matter')}
          </label>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {groupByCollaborator && (
                  <>
                    <TableHead>{t('dashboard.collaborator')}</TableHead>
                    <TableHead>{t('common.email')}</TableHead>
                  </>
                )}
                {groupByClient && (
                  <>
                    <TableHead>{t('dashboard.code')}</TableHead>
                    <TableHead>{t('dashboard.client')}</TableHead>
                  </>
                )}
                {groupByMatter && (
                  <>
                    <TableHead>{t('dashboard.code')}</TableHead>
                    <TableHead>{t('dashboard.matter')}</TableHead>
                  </>
                )}
                <TableHead className="text-right">{t('dashboard.hours')}</TableHead>
                <TableHead className="text-right">{t('dashboard.under30Days')}</TableHead>
                <TableHead className="text-right">{t('dashboard.d30to60Days')}</TableHead>
                <TableHead className="text-right">{t('dashboard.d60to90Days')}</TableHead>
                <TableHead className="text-right">{t('dashboard.d90to120Days')}</TableHead>
                <TableHead className="text-right">{t('dashboard.over120Days')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={
                      (groupByCollaborator ? 2 : 0) +
                      (groupByClient ? 2 : 0) +
                      (groupByMatter ? 2 : 0) +
                      6
                    }
                    className="text-center text-muted-foreground"
                  >
                    {t('common.noData')}
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {rows.map((row) => (
                    <TableRow key={row.key}>
                      {groupByCollaborator && (
                        <>
                          <TableCell className="font-medium">{row.userName}</TableCell>
                          <TableCell className="text-muted-foreground">{row.userEmail}</TableCell>
                        </>
                      )}
                      {groupByClient && (
                        <>
                          <TableCell><Badge variant="outline">{row.clientCode}</Badge></TableCell>
                          <TableCell className="font-medium">{row.clientName}</TableCell>
                        </>
                      )}
                      {groupByMatter && (
                        <>
                          <TableCell><Badge variant="outline">{row.matterCode}</Badge></TableCell>
                          <TableCell className="font-medium">{row.matterLabel}</TableCell>
                        </>
                      )}
                      <TableCell className="text-right font-medium">
                        {formatMinutesToHours(row.billableMinutes)}
                      </TableCell>
                      <TableCell className="text-right">{fmtAging(row.aging.under30)}</TableCell>
                      <TableCell className="text-right">{fmtAging(row.aging.d30to60)}</TableCell>
                      <TableCell className="text-right">{fmtAging(row.aging.d60to90)}</TableCell>
                      <TableCell className={cn("text-right", row.aging.d90to120 > 0 && "text-orange-600 font-semibold")}>
                        {fmtAging(row.aging.d90to120)}
                      </TableCell>
                      <TableCell className={cn("text-right", row.aging.over120 > 0 && "text-destructive font-semibold")}>
                        {fmtAging(row.aging.over120)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* TOTAL row */}
                  <TableRow className="border-t-2 font-bold bg-muted/30">
                    {groupByCollaborator && (
                      <>
                        <TableCell>{t('common.total')}</TableCell>
                        <TableCell />
                      </>
                    )}
                    {groupByClient && (
                      <>
                        <TableCell>{!groupByCollaborator ? t('common.total') : ''}</TableCell>
                        <TableCell />
                      </>
                    )}
                    {groupByMatter && (
                      <>
                        <TableCell>{!groupByCollaborator && !groupByClient ? t('common.total') : ''}</TableCell>
                        <TableCell />
                      </>
                    )}
                    <TableCell className="text-right">{formatMinutesToHours(totals.totalMinutes)}</TableCell>
                    <TableCell className="text-right">{fmtAging(totals.totalAging.under30)}</TableCell>
                    <TableCell className="text-right">{fmtAging(totals.totalAging.d30to60)}</TableCell>
                    <TableCell className="text-right">{fmtAging(totals.totalAging.d60to90)}</TableCell>
                    <TableCell className={cn("text-right", totals.totalAging.d90to120 > 0 && "text-orange-600 font-semibold")}>
                      {fmtAging(totals.totalAging.d90to120)}
                    </TableCell>
                    <TableCell className={cn("text-right", totals.totalAging.over120 > 0 && "text-destructive font-semibold")}>
                      {fmtAging(totals.totalAging.over120)}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
