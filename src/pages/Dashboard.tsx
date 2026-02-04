import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getTimesheetEntries,
  getUsers,
  getMatters,
  getClients,
  formatMinutesToHours,
  formatCents,
  getCabinetSettings,
} from '@/lib/storage';
import { Clock, Users, FolderOpen, TrendingUp, Download } from 'lucide-react';
import type { KPIByUser, KPIByMatter } from '@/types';

export default function Dashboard() {
  const { user } = useAuth();
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date();
    d.setDate(1); // First of month
    return d.toISOString().split('T')[0];
  });
  const [periodTo, setPeriodTo] = useState(() => new Date().toISOString().split('T')[0]);

  const entries = getTimesheetEntries();
  const users = getUsers();
  const matters = getMatters();
  const clients = getClients();
  const settings = getCabinetSettings();

  // Filter entries by period
  const filteredEntries = useMemo(() => {
    return entries.filter(e => e.date >= periodFrom && e.date <= periodTo);
  }, [entries, periodFrom, periodTo]);

  // Calculate KPIs
  const kpiSummary = useMemo(() => {
    const billable = filteredEntries.filter(e => e.billable);
    return {
      totalMinutes: filteredEntries.reduce((sum, e) => sum + e.minutesRounded, 0),
      totalBillableMinutes: billable.reduce((sum, e) => sum + e.minutesRounded, 0),
      totalEntries: filteredEntries.length,
      billableEntries: billable.length,
    };
  }, [filteredEntries]);

  const kpiByUser = useMemo<KPIByUser[]>(() => {
    const grouped = new Map<string, number>();
    filteredEntries.filter(e => e.billable).forEach(e => {
      const current = grouped.get(e.userId) || 0;
      grouped.set(e.userId, current + e.minutesRounded);
    });
    
    return Array.from(grouped.entries())
      .map(([userId, minutes]) => {
        const u = users.find(user => user.id === userId);
        return {
          userId,
          userName: u?.name || 'Inconnu',
          userEmail: u?.email || '',
          billableMinutes: minutes,
        };
      })
      .sort((a, b) => b.billableMinutes - a.billableMinutes);
  }, [filteredEntries, users]);

  const kpiByMatter = useMemo<KPIByMatter[]>(() => {
    const grouped = new Map<string, number>();
    filteredEntries.filter(e => e.billable).forEach(e => {
      const current = grouped.get(e.matterId) || 0;
      grouped.set(e.matterId, current + e.minutesRounded);
    });
    
    return Array.from(grouped.entries())
      .map(([matterId, minutes]) => {
        const m = matters.find(matter => matter.id === matterId);
        const c = clients.find(client => client.id === m?.clientId);
        return {
          matterId,
          matterCode: m?.code || '',
          matterLabel: m?.label || 'Inconnu',
          clientCode: c?.code || '',
          billableMinutes: minutes,
        };
      })
      .sort((a, b) => b.billableMinutes - a.billableMinutes);
  }, [filteredEntries, matters, clients]);

  // Estimated revenue (using cabinet default rate)
  const estimatedRevenue = useMemo(() => {
    return Math.round((kpiSummary.totalBillableMinutes * settings.rateCabinetCents) / 60);
  }, [kpiSummary.totalBillableMinutes, settings.rateCabinetCents]);

  if (user?.role !== 'owner') {
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
            <CardTitle className="text-sm font-medium">CA estimé</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCents(estimatedRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              basé sur le taux cabinet
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
          <Button variant="outline" size="sm">
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
          <Button variant="outline" size="sm">
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
    </div>
  );
}
