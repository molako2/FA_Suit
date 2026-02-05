import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTimesheetEntries, formatMinutesToHours } from '@/hooks/useTimesheet';
import { useProfiles } from '@/hooks/useProfiles';
import { useMatters } from '@/hooks/useMatters';
import { useClients } from '@/hooks/useClients';
import { useInvoices } from '@/hooks/useInvoices';
import { useCabinetSettings } from '@/hooks/useCabinetSettings';
import { Clock, Users, FolderOpen, TrendingUp, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { TimesheetExport } from '@/components/dashboard/TimesheetExport';
import { KPIAnalytics } from '@/components/dashboard/KPIAnalytics';
import { KPIAnalyticsFlatFee } from '@/components/dashboard/KPIAnalyticsFlatFee';
import { UnpaidInvoicesKPI } from '@/components/dashboard/UnpaidInvoicesKPI';
import type { KPIByUser, KPIByMatter } from '@/types';

// Format cents to MAD
function formatCents(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',') + ' MAD';
}

// Export functions
function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

function exportKPIByUserCSV(data: KPIByUser[], from: string, to: string) {
  const header = 'Collaborateur,Email,Minutes,Heures\n';
  const rows = data.map(r => 
    `"${r.userName}","${r.userEmail}",${r.billableMinutes},${(r.billableMinutes / 60).toFixed(2)}`
  ).join('\n');
  downloadCSV(header + rows, `kpi_collaborateurs_${from}_${to}.csv`);
}

function exportKPIByMatterCSV(data: KPIByMatter[], from: string, to: string) {
  const header = 'Code,Dossier,Client,Minutes,Heures\n';
  const rows = data.map(r => 
    `"${r.matterCode}","${r.matterLabel}","${r.clientCode}",${r.billableMinutes},${(r.billableMinutes / 60).toFixed(2)}`
  ).join('\n');
  downloadCSV(header + rows, `kpi_dossiers_${from}_${to}.csv`);
}

export default function Dashboard() {
  const { role } = useAuth();
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date();
    d.setDate(1); // First of month
    return d.toISOString().split('T')[0];
  });
  const [periodTo, setPeriodTo] = useState(() => new Date().toISOString().split('T')[0]);

  // Supabase hooks
  const { data: entries = [], isLoading: entriesLoading } = useTimesheetEntries(
    undefined, // All users for dashboard
    periodFrom,
    periodTo
  );
  const { data: profiles = [], isLoading: profilesLoading } = useProfiles();
  const { data: matters = [], isLoading: mattersLoading } = useMatters();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: invoices = [], isLoading: invoicesLoading } = useInvoices();
  const { data: settings, isLoading: settingsLoading } = useCabinetSettings();

  const isLoading = entriesLoading || profilesLoading || mattersLoading || clientsLoading || invoicesLoading || settingsLoading;

  // Calculate KPIs
  const kpiSummary = useMemo(() => {
    const billable = entries.filter(e => e.billable);
    return {
      totalMinutes: entries.reduce((sum, e) => sum + e.minutes_rounded, 0),
      totalBillableMinutes: billable.reduce((sum, e) => sum + e.minutes_rounded, 0),
      totalEntries: entries.length,
      billableEntries: billable.length,
    };
  }, [entries]);

  const kpiByUser = useMemo<KPIByUser[]>(() => {
    const grouped = new Map<string, number>();
    entries.filter(e => e.billable).forEach(e => {
      const current = grouped.get(e.user_id) || 0;
      grouped.set(e.user_id, current + e.minutes_rounded);
    });
    
    return Array.from(grouped.entries())
      .map(([userId, minutes]) => {
        const profile = profiles.find(p => p.id === userId);
        return {
          userId,
          userName: profile?.name || 'Inconnu',
          userEmail: profile?.email || '',
          billableMinutes: minutes,
        };
      })
      .sort((a, b) => b.billableMinutes - a.billableMinutes);
  }, [entries, profiles]);

  const kpiByMatter = useMemo<KPIByMatter[]>(() => {
    const grouped = new Map<string, number>();
    entries.filter(e => e.billable).forEach(e => {
      const current = grouped.get(e.matter_id) || 0;
      grouped.set(e.matter_id, current + e.minutes_rounded);
    });
    
    return Array.from(grouped.entries())
      .map(([matterId, minutes]) => {
        const m = matters.find(matter => matter.id === matterId);
        const c = clients.find(client => client.id === m?.client_id);
        return {
          matterId,
          matterCode: m?.code || '',
          matterLabel: m?.label || 'Inconnu',
          clientCode: c?.code || '',
          billableMinutes: minutes,
        };
      })
      .sort((a, b) => b.billableMinutes - a.billableMinutes);
  }, [entries, matters, clients]);

  // Total invoiced revenue (issued invoices in period)
  const totalInvoicedRevenue = useMemo(() => {
    return invoices
      .filter(inv => inv.status === 'issued' && inv.issue_date && inv.issue_date >= periodFrom && inv.issue_date <= periodTo)
      .reduce((sum, inv) => sum + inv.total_ht_cents, 0);
  }, [invoices, periodFrom, periodTo]);

  if (role !== 'owner' && role !== 'sysadmin') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Accès réservé aux associés.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleExportKPIByUser = () => {
    exportKPIByUserCSV(kpiByUser, periodFrom, periodTo);
    toast.success('Export KPI par collaborateur téléchargé');
  };

  const handleExportKPIByMatter = () => {
    exportKPIByMatterCSV(kpiByMatter, periodFrom, periodTo);
    toast.success('Export KPI par dossier téléchargé');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard KPI</h1>
          <p className="text-muted-foreground">Aperçu de l'activité du cabinet</p>
        </div>
        
        {/* Period Selector */}
        <div className="flex items-center gap-2">
          <div className="grid gap-1">
            <Label htmlFor="from" className="text-xs">Du</Label>
            <Input
              id="from"
              type="date"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
              className="w-36"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="to" className="text-xs">Au</Label>
            <Input
              id="to"
              type="date"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
              className="w-36"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Heures facturables</CardTitle>
            <Clock className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMinutesToHours(kpiSummary.totalBillableMinutes)}</div>
            <p className="text-xs text-muted-foreground">
              sur {formatMinutesToHours(kpiSummary.totalMinutes)} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA facturé</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCents(totalInvoicedRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              factures émises sur la période
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collaborateurs actifs</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiByUser.length}</div>
            <p className="text-xs text-muted-foreground">
              ont saisi du temps
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dossiers actifs</CardTitle>
            <FolderOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiByMatter.length}</div>
            <p className="text-xs text-muted-foreground">
              avec temps facturable
            </p>
          </CardContent>
        </Card>
      </div>

      {/* KPI by User */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Par collaborateur</CardTitle>
            <CardDescription>Heures facturables par collaborateur sur la période</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportKPIByUser}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Collaborateur</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Minutes</TableHead>
                <TableHead className="text-right">Heures</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpiByUser.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Aucune donnée pour cette période
                  </TableCell>
                </TableRow>
              ) : (
                kpiByUser.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell className="font-medium">{row.userName}</TableCell>
                    <TableCell className="text-muted-foreground">{row.userEmail}</TableCell>
                    <TableCell className="text-right">{row.billableMinutes}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMinutesToHours(row.billableMinutes)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* KPI by Matter */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Par dossier</CardTitle>
            <CardDescription>Heures facturables par dossier sur la période</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportKPIByMatter}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Dossier</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Minutes</TableHead>
                <TableHead className="text-right">Heures</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpiByMatter.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Aucune donnée pour cette période
                  </TableCell>
                </TableRow>
              ) : (
                kpiByMatter.map((row) => (
                  <TableRow key={row.matterId}>
                    <TableCell>
                      <Badge variant="outline">{row.matterCode}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{row.matterLabel}</TableCell>
                    <TableCell className="text-muted-foreground">{row.clientCode}</TableCell>
                    <TableCell className="text-right">{row.billableMinutes}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMinutesToHours(row.billableMinutes)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* KPI Analytics with cross-reference */}
      <KPIAnalytics
        entries={entries}
        profiles={profiles}
        matters={matters}
        clients={clients}
        invoices={invoices}
        defaultRateCents={settings?.rate_cabinet_cents || 15000}
      />

      {/* KPI Analytics for flat-fee */}
      <KPIAnalyticsFlatFee
        matters={matters}
        clients={clients}
        invoices={invoices}
      />

      {/* Unpaid Invoices KPI */}
      <UnpaidInvoicesKPI
        invoices={invoices}
        matters={matters}
        clients={clients}
      />

      {/* Timesheet Export */}
      <TimesheetExport
        entries={entries}
        profiles={profiles}
        matters={matters}
        clients={clients}
      />
    </div>
  );
}
