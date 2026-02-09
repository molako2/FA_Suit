import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useTimesheetEntries } from '@/hooks/useTimesheet';
import { useProfiles } from '@/hooks/useProfiles';
import { useMatters } from '@/hooks/useMatters';
import { useClients } from '@/hooks/useClients';
import { useInvoices } from '@/hooks/useInvoices';
import { useCabinetSettings } from '@/hooks/useCabinetSettings';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import type { ChartConfig } from '@/components/ui/chart';

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(210, 70%, 55%)',
  'hsl(150, 60%, 45%)',
  'hsl(30, 80%, 55%)',
  'hsl(340, 65%, 50%)',
  'hsl(260, 55%, 55%)',
  'hsl(180, 50%, 45%)',
  'hsl(45, 75%, 50%)',
  'hsl(0, 60%, 50%)',
];

export default function DashboardCharts() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date();
    d.setMonth(0, 1);
    return d.toISOString().split('T')[0];
  });
  const [periodTo, setPeriodTo] = useState(() => new Date().toISOString().split('T')[0]);

  const { data: entries = [], isLoading: entriesLoading } = useTimesheetEntries(undefined, periodFrom, periodTo);
  const { data: profiles = [] } = useProfiles();
  const { data: matters = [] } = useMatters();
  const { data: clients = [] } = useClients();
  const { data: invoices = [] } = useInvoices();
  const { data: settings } = useCabinetSettings();

  const isLoading = entriesLoading;

  // 1. Hours by collaborator (billable vs non-billable)
  const hoursByCollab = useMemo(() => {
    const map = new Map<string, { billable: number; nonBillable: number }>();
    entries.forEach(e => {
      const current = map.get(e.user_id) || { billable: 0, nonBillable: 0 };
      if (e.billable) {
        current.billable += e.minutes_rounded;
      } else {
        current.nonBillable += e.minutes_rounded;
      }
      map.set(e.user_id, current);
    });
    return Array.from(map.entries())
      .map(([userId, data]) => {
        const profile = profiles.find(p => p.id === userId);
        return {
          name: profile?.name || t('common.unknown'),
          billable: +(data.billable / 60).toFixed(1),
          nonBillable: +(data.nonBillable / 60).toFixed(1),
        };
      })
      .sort((a, b) => (b.billable + b.nonBillable) - (a.billable + a.nonBillable));
  }, [entries, profiles, t]);

  // 2. Top 10 Clients
  const top10Clients = useMemo(() => {
    const map = new Map<string, number>();
    entries.filter(e => e.billable && !e.locked).forEach(e => {
      const matter = matters.find(m => m.id === e.matter_id);
      if (!matter) return;
      const current = map.get(matter.client_id) || 0;
      map.set(matter.client_id, current + e.minutes_rounded);
    });
    return Array.from(map.entries())
      .map(([clientId, minutes]) => {
        const client = clients.find(c => c.id === clientId);
        return { name: client?.name || t('common.unknown'), hours: +(minutes / 60).toFixed(1) };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);
  }, [entries, matters, clients, t]);

  // 3. Top 10 Matters
  const top10Matters = useMemo(() => {
    const map = new Map<string, number>();
    entries.filter(e => e.billable && !e.locked).forEach(e => {
      const current = map.get(e.matter_id) || 0;
      map.set(e.matter_id, current + e.minutes_rounded);
    });
    return Array.from(map.entries())
      .map(([matterId, minutes]) => {
        const matter = matters.find(m => m.id === matterId);
        return { name: matter?.code || t('common.unknown'), hours: +(minutes / 60).toFixed(1) };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);
  }, [entries, matters, t]);

  // 4. Monthly revenue evolution
  const monthlyRevenue = useMemo(() => {
    const year = new Date(periodFrom).getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => {
      const monthStr = String(i + 1).padStart(2, '0');
      const startOfMonth = `${year}-${monthStr}-01`;
      const endOfMonth = new Date(year, i + 1, 0).toISOString().split('T')[0];

      // WIP: billable & unlocked entries in this month
      const defaultRate = settings?.rate_cabinet_cents || 15000;
      const wipCents = entries
        .filter(e => e.billable && !e.locked && e.date >= startOfMonth && e.date <= endOfMonth)
        .reduce((sum, e) => {
          const matter = matters.find(m => m.id === e.matter_id);
          const rate = matter?.rate_cents || defaultRate;
          return sum + Math.round((e.minutes_rounded / 60) * rate);
        }, 0);

      // Invoiced: issued invoices in this month
      const invoicedCents = invoices
        .filter(inv => inv.status === 'issued' && inv.issue_date && inv.issue_date >= startOfMonth && inv.issue_date <= endOfMonth)
        .reduce((sum, inv) => sum + inv.total_ht_cents, 0);

      // Collected: paid invoices in this month
      const collectedCents = invoices
        .filter(inv => inv.paid && inv.payment_date && inv.payment_date >= startOfMonth && inv.payment_date <= endOfMonth)
        .reduce((sum, inv) => sum + inv.total_ht_cents, 0);

      const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
      return {
        month: monthNames[i],
        wip: +(wipCents / 100).toFixed(0),
        invoiced: +(invoicedCents / 100).toFixed(0),
        collected: +(collectedCents / 100).toFixed(0),
      };
    });
    return months;
  }, [entries, invoices, matters, settings, periodFrom]);

  // 5. Billing type distribution (pie)
  const billingTypeData = useMemo(() => {
    let timeBasedMinutes = 0;
    let flatFeeMinutes = 0;
    entries.forEach(e => {
      const matter = matters.find(m => m.id === e.matter_id);
      if (matter?.billing_type === 'flat_fee') {
        flatFeeMinutes += e.minutes_rounded;
      } else {
        timeBasedMinutes += e.minutes_rounded;
      }
    });
    if (timeBasedMinutes === 0 && flatFeeMinutes === 0) return [];
    return [
      { name: t('charts.timeBased'), value: +(timeBasedMinutes / 60).toFixed(1), fill: 'hsl(var(--primary))' },
      { name: t('charts.flatFee'), value: +(flatFeeMinutes / 60).toFixed(1), fill: 'hsl(var(--accent))' },
    ];
  }, [entries, matters, t]);

  // 6. Recovery rate by month
  const recoveryRate = useMemo(() => {
    const year = new Date(periodFrom).getFullYear();
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    return Array.from({ length: 12 }, (_, i) => {
      const monthStr = String(i + 1).padStart(2, '0');
      const startOfMonth = `${year}-${monthStr}-01`;
      const endOfMonth = new Date(year, i + 1, 0).toISOString().split('T')[0];

      const invoicedCents = invoices
        .filter(inv => inv.status === 'issued' && inv.issue_date && inv.issue_date >= startOfMonth && inv.issue_date <= endOfMonth)
        .reduce((sum, inv) => sum + inv.total_ht_cents, 0);

      const collectedCents = invoices
        .filter(inv => inv.paid && inv.payment_date && inv.payment_date >= startOfMonth && inv.payment_date <= endOfMonth)
        .reduce((sum, inv) => sum + inv.total_ht_cents, 0);

      const rate = invoicedCents > 0 ? Math.round((collectedCents / invoicedCents) * 100) : 0;
      return { month: monthNames[i], rate };
    });
  }, [invoices, periodFrom]);

  // Chart configs
  const collabConfig: ChartConfig = {
    billable: { label: t('charts.billable'), color: 'hsl(var(--primary))' },
    nonBillable: { label: t('charts.nonBillable'), color: 'hsl(0, 65%, 30%)' },
  };

  const top10Config: ChartConfig = {
    hours: { label: t('dashboard.hours'), color: 'hsl(var(--primary))' },
  };

  const revenueConfig: ChartConfig = {
    wip: { label: t('charts.wipRevenue'), color: 'hsl(var(--accent))' },
    invoiced: { label: t('charts.invoicedRevenue'), color: 'hsl(var(--primary))' },
    collected: { label: t('charts.collectedRevenue'), color: 'hsl(150, 60%, 45%)' },
  };

  const pieConfig: ChartConfig = {
    timeBased: { label: t('charts.timeBased'), color: 'hsl(var(--primary))' },
    flatFee: { label: t('charts.flatFee'), color: 'hsl(var(--accent))' },
  };

  const recoveryConfig: ChartConfig = {
    rate: { label: t('charts.recoveryRatePercent'), color: 'hsl(var(--primary))' },
  };

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
          <h1 className="text-3xl font-bold">{t('charts.title')}</h1>
          <p className="text-muted-foreground">{t('charts.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="grid gap-1">
            <Label htmlFor="chart-from" className="text-xs">{t('common.from')}</Label>
            <Input id="chart-from" type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} className="w-36" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="chart-to" className="text-xs">{t('common.to')}</Label>
            <Input id="chart-to" type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} className="w-36" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 1. Hours by collaborator */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">{t('charts.hoursByCollaborator')}</CardTitle>
            <CardDescription>{t('charts.hoursByCollaboratorDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {hoursByCollab.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('common.noData')}</p>
            ) : (
              <ChartContainer config={collabConfig} className="h-[350px] w-full">
                <BarChart data={hoursByCollab} layout="vertical" barSize={12} margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="billable" stackId="a" fill="var(--color-billable)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="nonBillable" stackId="a" fill="var(--color-nonBillable)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* 2. Top 10 Clients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('charts.top10Clients')}</CardTitle>
            <CardDescription>{t('charts.top10ClientsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {top10Clients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('common.noData')}</p>
            ) : (
              <ChartContainer config={top10Config} className="h-[350px] w-full">
                <BarChart data={top10Clients} layout="vertical" barSize={12} margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="hours" fill="var(--color-hours)" radius={[0, 4, 4, 0]}>
                    {top10Clients.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* 3. Top 10 Matters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('charts.top10Matters')}</CardTitle>
            <CardDescription>{t('charts.top10MattersDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {top10Matters.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('common.noData')}</p>
            ) : (
              <ChartContainer config={top10Config} className="h-[350px] w-full">
                <BarChart data={top10Matters} layout="vertical" barSize={12} margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="hours" fill="var(--color-hours)" radius={[0, 4, 4, 0]}>
                    {top10Matters.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* 4. Monthly Revenue Evolution */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">{t('charts.monthlyRevenue')}</CardTitle>
            <CardDescription>{t('charts.monthlyRevenueDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueConfig} className="h-[350px] w-full">
              <BarChart data={monthlyRevenue} margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `${formatCents(v * 100)}`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="wip" fill="var(--color-wip)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="invoiced" fill="var(--color-invoiced)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="collected" fill="var(--color-collected)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* 5. Billing type distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('charts.billingTypeDistribution')}</CardTitle>
            <CardDescription>{t('charts.billingTypeDistributionDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {billingTypeData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('common.noData')}</p>
            ) : (
              <ChartContainer config={pieConfig} className="h-[350px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie
                    data={billingTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}h`}
                  >
                    {billingTypeData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* 6. Recovery rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('charts.recoveryRate')}</CardTitle>
            <CardDescription>{t('charts.recoveryRateDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={recoveryConfig} className="h-[350px] w-full">
              <BarChart data={recoveryRate} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="rate" fill="var(--color-rate)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
