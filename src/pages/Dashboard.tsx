import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTimesheetEntries, formatMinutesToHours } from '@/hooks/useTimesheet';
import { useProfiles } from '@/hooks/useProfiles';
import { useMatters } from '@/hooks/useMatters';
import { useClients } from '@/hooks/useClients';
import { useInvoices } from '@/hooks/useInvoices';
import { useCabinetSettings } from '@/hooks/useCabinetSettings';
import { Clock, Users, FolderOpen, TrendingUp, Loader2, Banknote, Briefcase } from 'lucide-react';
import { TimesheetExport } from '@/components/dashboard/TimesheetExport';
import { KPIAnalytics } from '@/components/dashboard/KPIAnalytics';
import { KPIAnalyticsFlatFee } from '@/components/dashboard/KPIAnalyticsFlatFee';
import { UnpaidInvoicesKPI } from '@/components/dashboard/UnpaidInvoicesKPI';
import { WIPAgingAnalysis } from '@/components/dashboard/WIPAgingAnalysis';
import type { KPIByUser, KPIByMatter } from '@/types';

// Format cents to MAD
function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
}


export default function Dashboard() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [periodTo, setPeriodTo] = useState(() => new Date().toISOString().split('T')[0]);

  // Supabase hooks
  const { data: entries = [], isLoading: entriesLoading } = useTimesheetEntries(undefined, periodFrom, periodTo);
  const { data: profiles = [], isLoading: profilesLoading } = useProfiles();
  const { data: matters = [], isLoading: mattersLoading } = useMatters();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: invoices = [], isLoading: invoicesLoading } = useInvoices();
  const { data: settings, isLoading: settingsLoading } = useCabinetSettings();

  const isLoading = entriesLoading || profilesLoading || mattersLoading || clientsLoading || invoicesLoading || settingsLoading;

  // Calculate KPIs
  const kpiSummary = useMemo(() => {
    const billable = entries.filter(e => e.billable && !e.locked);
    return {
      totalMinutes: entries.reduce((sum, e) => sum + e.minutes_rounded, 0),
      totalBillableMinutes: billable.reduce((sum, e) => sum + e.minutes_rounded, 0),
      totalEntries: entries.length,
      billableEntries: billable.length,
    };
  }, [entries]);

  const kpiByUser = useMemo<KPIByUser[]>(() => {
    const grouped = new Map<string, number>();
    entries.filter(e => e.billable && !e.locked).forEach(e => {
      const current = grouped.get(e.user_id) || 0;
      grouped.set(e.user_id, current + e.minutes_rounded);
    });
    
    return Array.from(grouped.entries())
      .map(([userId, minutes]) => {
        const profile = profiles.find(p => p.id === userId);
        return {
          userId,
          userName: profile?.name || t('common.unknown'),
          userEmail: profile?.email || '',
          billableMinutes: minutes,
        };
      })
      .sort((a, b) => b.billableMinutes - a.billableMinutes);
  }, [entries, profiles, t]);

  const kpiByMatter = useMemo<KPIByMatter[]>(() => {
    const grouped = new Map<string, number>();
    entries.filter(e => e.billable && !e.locked).forEach(e => {
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
          matterLabel: m?.label || t('common.unknown'),
          clientCode: c?.code || '',
          billableMinutes: minutes,
        };
      })
      .sort((a, b) => b.billableMinutes - a.billableMinutes);
  }, [entries, matters, clients, t]);

  const totalInvoicedRevenue = useMemo(() => {
    return invoices
      .filter(inv => inv.status === 'issued' && inv.issue_date && inv.issue_date >= periodFrom && inv.issue_date <= periodTo)
      .reduce((sum, inv) => sum + inv.total_ht_cents, 0);
  }, [invoices, periodFrom, periodTo]);

  const totalPaidRevenue = useMemo(() => {
    return invoices
      .filter(inv => inv.paid && inv.payment_date && inv.payment_date >= periodFrom && inv.payment_date <= periodTo)
      .reduce((sum, inv) => sum + inv.total_ht_cents, 0);
  }, [invoices, periodFrom, periodTo]);

  // CA Forfait facturable : dossiers flat_fee sans facture émise
  const totalFlatFeeBillable = useMemo(() => {
    const issuedMatterIds = new Set(
      invoices.filter(inv => inv.status === 'issued').map(inv => inv.matter_id)
    );
    return matters
      .filter(m => m.billing_type === 'flat_fee' && !issuedMatterIds.has(m.id))
      .reduce((sum, m) => sum + (m.flat_fee_cents || 0), 0);
  }, [matters, invoices]);

  if (role !== 'owner' && role !== 'sysadmin') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">{t('dashboard.accessRestricted')}</p>
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


  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="grid gap-1">
            <Label htmlFor="from" className="text-xs">{t('common.from')}</Label>
            <Input id="from" type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} className="w-36" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="to" className="text-xs">{t('common.to')}</Label>
            <Input id="to" type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} className="w-36" />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.wipHoursCard')}</CardTitle>
            <Clock className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMinutesToHours(kpiSummary.totalBillableMinutes)}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.wipHoursSubtitle')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.flatFeeBillableCard')}</CardTitle>
            <Briefcase className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCents(totalFlatFeeBillable)}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.flatFeeBillableSubtitle')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.invoicedRevenue')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCents(totalInvoicedRevenue)}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.issuedInvoicesPeriod')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.collectedRevenue')}</CardTitle>
            <Banknote className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCents(totalPaidRevenue)}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.paidInvoicesPeriod')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.activeCollaborators')}</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiByUser.length}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.loggedTime')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.activeMatters')}</CardTitle>
            <FolderOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiByMatter.length}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.withBillableTime')}</p>
          </CardContent>
        </Card>
      </div>

      {/* WIP Aging Analysis - unified KPI block */}
      <WIPAgingAnalysis
        entries={entries}
        profiles={profiles}
        matters={matters}
        clients={clients}
        periodFrom={periodFrom}
        periodTo={periodTo}
      />

      <KPIAnalytics entries={entries} profiles={profiles} matters={matters} clients={clients} invoices={invoices} defaultRateCents={settings?.rate_cabinet_cents || 15000} />
      <KPIAnalyticsFlatFee matters={matters} clients={clients} invoices={invoices} />
      <UnpaidInvoicesKPI invoices={invoices} matters={matters} clients={clients} />
      <TimesheetExport entries={entries} profiles={profiles} matters={matters} clients={clients} />
    </div>
  );
}
